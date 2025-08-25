# Cursor One-Shot Prompt — **ElectionBot** (complete spec + implementation guidance)

You are to implement an end-to-end production-ready **ElectionBot** for Discord. This is a one-shot task: research needed libraries, produce a full TypeScript Node project, wire up Discord slash commands, implement all business logic, and persist all authoritative state only in **GitHub Gists** using the `@octokit/rest` client and the provided GitHub Personal Access Token.

**Secrets provided:** Discord Client ID, Discord Bot Token, GitHub Personal access token (has all required gist permissions).

**Primary requirements (summary):**
- Use `discord.js v14` and the Discord Interactions API (slash commands only).
- Use `@octokit/rest` (Octokit) for all remote storage — **never store state on disk**.
  - Authoritative state lives in GitHub gists. No local DB or files. In-memory caches are allowed only at runtime; on restart, rebuild state from gists.
- Write in **TypeScript** (target: Node v18+). Project must be modular and testable.
- Follow the finalized economic rules (see **Economy & Settlement** below).
- Ensure safe concurrency, atomic updates, validation, and signed vote verification.

---

## High-level behavior & rules

### Roles & Permissions
- A server role named `electionBotAdmin` (exact name) has admin powers:
  - `/create` (create election), `/delete` (delete election), `/reset bot` (reset server state).
- Party leader permissions enforced per party.
- All other commands follow rules below.

### Server scoping
- **Every election and its data are server-specific** (partition by Discord Guild ID).
- Keep a central `gistIndex` (a gist) mapping `guildId` → { `publicGistId`, `privateGistId`, `meta` } so the bot can find the latest election gists for a guild.
  - `gistIndex` is also stored as a gist (single source of truth). Treat it as authoritative and update it atomically.

### Never persist data locally
- Do not write any authoritative data to disk. The only allowed local write is `.env` (for secrets), which will not contain runtime data.
- Use in-memory caches at runtime for performance, but always persist the canonical copy to gists after every state change.
- On process restart, reconstruct runtime state from `gistIndex` + relevant gists.

---

## Commands (slash-style) — complete signature behavior

### Election-level (admin only)
- `/create [start: ISO8601 datetime optional] [durationHours: number optional]`
  - Defaults: `start = now`, `durationHours = 24`.
  - Creates 2 gists for the new election: **public gist** and **private gist** (private gist = secret gist).
  - Public gist file names: `public.json`. Private gist file: `private_votes.json`.
  - Add entry to `gistIndex` for this guild → store gist ids.
  - Reply ephemeral success with election id and gist links (public gist link only).
- `/delete`
  - Admin-only: deletes the election for the guild (delete both gists and remove from `gistIndex`).
  - Confirm with ephemeral prompt before deleting (require admin reaction).
- `/reset bot`
  - Admin-only: clear server references (remove `gistIndex` entry) — do not delete gists unless explicitly requested.
- `/list elections`
  - Show active/past elections known for the guild (read `gistIndex`).

### Party management
- `/create party <name:string> <emoji:string> <agenda:string>`
  - Creates party in the current active election (error if none).
  - Creator becomes **leader** and a **member**.
  - Validate `name` uniqueness for that election.
  - Update public gist atomically.
- `/edit party <partyName:string> <agenda:string>`
  - Allowed by party leader OR any current member of that party.
- `/delete party <partyName:string>`
  - Only leader or `electionBotAdmin`.
- `/join party <partyName:string>`
  - Starts a join-request flow:
    - Bot posts a message visible to leader (and optionally channel) tagging leader and the requester.
    - Leader must react with ✅ or ❌ within **30 seconds**.
    - On ✅ the member is added (enforce that a user may be in at most one party in that guild).
    - On ❌ or timeout, reject with ephemeral feedback to the requester.
  - Implement reaction handling reliably (store message ID and expected reactor; if leader not present handle later via button fallback).
- `/leave party <partyName?>`
  - Self-explanatory. If leader leaves, **delete the party** and handle fund redistribution at election end rules.
- `/list parties`
  - Show each party’s: leader, members, vault balance, bond pool size, tokens issued, tokens sold.

### Voter registration
- `/register voter <rsaPublicKey:string>`
  - Register your RSA public key for the current election (string in PEM format).
  - Validate the key is a legitimate RSA public key (use Node `crypto` to parse).
  - Every voter (including party leaders & members) **must** register to be allowed to vote.

### Voting
- `/vote <partyName:string> <message:string> <signature:base64>`
  - Preconditions: election is active, user is registered, user hasn't voted yet.
  - Verify signature: verify the signature signs exactly the `message` with the registered RSA public key using `RSA-PSS` with SHA-256. Use Node built-in `crypto.verify`:
    ```ts
    crypto.verify(
      'sha256',
      Buffer.from(message, 'utf8'),
      { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PSS_PADDING },
      Buffer.from(signature, 'base64')
    )
    ```
  - Validate `message` content equals an allowed party name (one of the registered party names) — otherwise reject and instruct to resubmit.
  - Store the vote (voterId, message, signature, timestamp) in the **private gist** only. Do not include votes in the public gist until the election ends.
  - Each user may vote **exactly once** per election.

### Election Bonds (party finance)
- `/create election bonds <partyName:string> <amount:number> <tokens:number> <alpha:number>`
  - Only the party leader (and only after party exists) can create (issue) bonds.
  - `amount` = coins the party is committing to start the pool (leader must have available coins).
  - `tokens` = total tokens to issue (N).
  - `alpha` ∈ [0,1] determines how much of incoming buys goes to pool vs vault.
  - Initial constant `k = P * N` (P = initial amount).
  - Deduct `amount` from leader’s available coins (enforce no double-spend).
  - Record `issuedTokens = N`, `soldTokens = 0`, `pool = amount`, `vault = 0` (vault accumulates campaign funds).
- `/buy election bonds <partyName:string> <coins:number>`
  - Anyone may buy tokens for a party. Price mechanics:
    - Current price to buy next tiny delta of token is `price = k / (remainingTokens)`, where `remainingTokens = issuedTokens - soldTokens`. Use numeric safeguards.
    - A buy of `X` coins splits: `alpha * X` → pool, `(1 - alpha) * X` → vault.
    - Convert the coin spend into number of tokens purchased by simulating the bonding curve price (you must compute tokens acquired by integrating price over tokens, or for discrete simplicity, implement iterative step-buy or closed form depending on curve chosen). For clarity: use constant product curve model that holds `k = P * N` and price for marginal token = `k / remainingTokens`.
  - Deduct `coins` from buyer's balance (ensure buyer has enough available coins).
  - Increase `soldTokens` accordingly and credit buyer's token holdings (per-party per-user token ledger).
- `/sell election bonds <partyName:string> <tokens:number>`
  - Users may sell back tokens at current market price (marginal price based on remaining tokens+sold tokens after burn).
  - Refund coins into user balance, deduct pool accordingly, decrement user's token holdings.

> Implementation note: be robust to fractional tokens and floating math errors — store monetary units as integers (e.g., microcoins) or use `bigint`/`decimal.js` for safety.

### Campaign
- `/campaign <partyName:string> <headline:string> <body:string>`
  - Only party members (or leader) may campaign for their own party.
  - Cost of campaign = configurable cost or derived from message length (default: 1 coin per 100 chars, min 1 coin); charged to **party vault**.
  - Bot posts an embedded message: `Campaign for <party> by <user>` and the campaign content.
  - Deny if vault insufficient.

---

## Activity monitoring & "money from chat" rules

You asked to award/monitor “points per message normalized by server activity in last X time (this is money)”. Implement as follows and make `X` configurable (default `24h`) and `activity_reward_pool` configurable (default `50` coins per `X` period).

- Maintain an activity histogram for the guild for the normalization window X (only message counts, not message contents).
- Periodically (e.g., hourly or on-demand) distribute `activity_reward_pool` coins proportionally to message counts during the last X:
  - If total messages M in window, user with m messages receives `reward = (m / M) * activity_reward_pool`.
  - Record these delta changes to user balances in the public gist atomically.
- New users still default to 100 coins base when first seen; activity rewards are additional delta credits.
- Provide admin config to set `activity_reward_pool = 0` to disable minting if you want fixed supply.

**Important:** Make clear in README that activity rewards are minted by the system and will increase total supply; include an optional mode where activity rewards are drawn from a configured `systemReserve` to preserve fixed supply.

---

## Economy specifics, formulas & final settlement (explicit, final rules)

**Initial condition:**
- Every new user is assumed to start with **100 coins** by default. We track only deltas in gist state: `userBalanceDelta`, and effective balance = `100 + delta`. Record every balance change with transaction entry.

**Bond & token model (per party):**
- When leader issues: `P` coins and `N` tokens issued ⇒ `k = P * N`.
- `issuedTokens = N`. `soldTokens` increases with buys.
- `remainingTokens = issuedTokens - soldTokens`.
- Marginal price formula used in buys/sells: `price = k / remainingTokens`. (Implement safe numeric approximations.)
- On buy: compute token amount acquired given coin spend and alpha split: `poolAdd = alpha * X`, `vaultAdd = (1 - alpha) * X`. Deduct `X` coins from buyer. Increase pool and vault accordingly, and increase `soldTokens`.
- Enforce **no double-spend**: before any spend, create a per-user `reserved` field for pending transactions; validate `available = 100 + delta - reserved`. All writes commit by updating gist atomically to remove `reserved`. Use optimistic locking and retries (see Atomicity section).

**End-of-Election Settlement (precise ordered steps):**
1. **Merge Pools:** Gather **bond pools** from all parties into a single `combinedPool`.
2. **Compute final token price for winner:**  
   - `finalPrice = combinedPool / totalTokensIssuedByWinningParty`  
     — used `totalTokensIssued` (i.e., `issuedTokens`), not outstanding/sold-only.  
3. **Liquidate winning tokens:** For every holder of **winning party tokens**, pay: `coins = tokensHeld * finalPrice`. Add these coins to each holder’s balance.
4. **Liquidate unsold tokens:** Any unsold winning tokens (i.e., `issuedTokens - soldTokens`) are considered "owned" by the party and are liquidated at the same `finalPrice`. The proceeds of that liquidation go into the **winning party’s vault**.
5. **Vault distribution:** After step (4), for **each party** (including the winning party), split that party's vault equally among its **members** (leader included). Vault share per member = `vaultBalance / memberCount`. Add that share to each member’s balance.
   - If a party has `memberCount == 0`, ledger decision: default to burning that vault (or admin reclaim) — implement a configuration option `onEmptyPartyVault = 'burn' | 'admin'`.
6. **Reset:** Remove all parties and tokens for the election; make the private gist (votes) public; archive the public gist (mark as `finalized` with settlement snapshot). Users carry forward coin balances only.

**Net effect:** Only bond **pools** are merged to set the winning party price; **vaults are not merged** and are distributed per-party. Losing token holders get zero from their bond tokens. Unsold tokens of the winning party add to its vault before per-party vault distribution.

---

## Data model (JSON schemas) — how data is stored in gists

**Public gist file `public.json`** (example schema):
```json
{
  "electionId": "uuid",
  "guildId": "string",
  "createdAt": "ISO8601",
  "startAt": "ISO8601",
  "durationHours": 24,
  "status": "scheduled|running|ended|finalized",
  "parties": {
    "partyName1": {
      "name": "partyName1",
      "emoji": "🔵",
      "agenda": "string",
      "leaderId": "discordUserId",
      "members": ["id1","id2"],
      "vault": 12345,         // integer microcoins
      "pool": 6789,          // integer microcoins
      "issuedTokens": 1000,
      "soldTokens": 400,
      "alpha": 0.6,
      "k": 1000 * 50,        // explicit store for ease
      "tokenHolders": { "userId1": 123, "userId2": 50 } // token counts
    }
  },
  "balances": { "userIdA":  -10, "userIdB": 50 }, // delta from 100 initial, in microcoins
  "reserved": { "userIdA": 0, "userIdB": 100 }, // pending reservations to avoid double-spend
  "registeredVoters": { "userId": "pemPublicKeyString" },
  "meta": { "version": 1, "lastUpdated": "ISO8601" }
}
```

**Private gist `private_votes.json`** (kept secret until end):
```json
{
  "electionId": "uuid",
  "votes": [
    {
      "voterId": "discordUserId",
      "message": "partyName",
      "signature": "base64signature",
      "timestamp": "ISO8601"
    }
  ]
}
```

**gistIndex gist**:
```json
{
  "maintainer": "bot",
  "entries": {
    "guildId1": {
       "publicGistId": "abc...",
       "privateGistId": "def...",
       "electionId": "uuid",
       "createdAt": "ISO8601"
    }
  }
}
```

**All currency fields use an integer subunit (microcoins).** In README, specify 1 coin = 1_000_000 microcoins.

---

## Atomic updates, concurrency & durability

- **Always** read the current public gist with `octokit.gists.get()` and then apply updates using `octokit.gists.update()` with the full new `public.json` body. To avoid race conditions:
  - Use an optimistic locking approach: store `meta.version` and `meta.lastUpdated`.
  - On update, read gist, check `meta.version` hasn't changed, increment `meta.version`, and update. If during update you detect a different `meta.version`, retry the read/merge/update flow (with safe retry limits).
  - Alternatively, implement a simple "soft lock" field `meta.lockedBy` with timestamp and owner, but prefer optimistic retries to avoid stale locks.
- For financial ops: perform validation → reserve funds (update `reserved`) → commit final update removing reservation. Do not finalize writes until you have the updated gist saved.

---

## Crypto & Signature verification
- Use Node `crypto` to verify RSA-PSS signatures with SHA-256 as shown above.
- Expect `signature` to be **base64**.
- Public keys must be provided in PEM format. Validate keys on registration. Reject keys that cannot be parsed.
- If a user tries to vote without proper registration or with an invalid signature, return an ephemeral error and instructions.

---

## Security & Best Practices
- Keep secrets in `.env` (DO NOT commit `.env`).
- Limit the bot to the required OAuth scopes:
  - `applications.commands`, `bot` plus the necessary guild scopes.
- Rate-limit Octokit requests with built-in throttling/backoff and handle 403/429 gracefully.
- Validate inputs (lengths, characters) to prevent gist injection or overly large gists.
- For private gists: set `public: false`. Note: GitHub “secret gist” is not private to someone with gist ID; treat these as secret but not ultra-secure. Warn in README that votes stored in private gists are secret only until they are made public at election end.

---

## Suggested repo layout (deliverables)
```
/README.md
/.env.example
/package.json
/tsconfig.json
/src/
  index.ts                # bot bootstrap + slash registration
  commands/
    createElection.ts
    deleteElection.ts
    createParty.ts
    joinParty.ts
    registerVoter.ts
    vote.ts
    buyBonds.ts
    sellBonds.ts
    campaign.ts
    listParties.ts
    listElections.ts
  storage/
    github.ts             # octokit wrapper: getPublicGist(guild), updatePublicGistAtomic(...)
  economy/
    bonds.ts              # price functions, buy/sell helpers, liquidation helpers
    settlement.ts         # end-of-election logic (merging pools, finalPrice, distribution)
  utils/
    permissions.ts
    crypto.ts             # verifySignature, parsePublicKey
    numbers.ts            # safe decimal helpers
  tests/
    unit/                 # unit tests for bonds, settlement, cryptography
/scripts/
  deploySlashCommands.ts  # register slash commands
```

---

## Tests & local dev
- Provide unit tests (Jest or Vitest) for:
  - Bond pricing / buy-sell correctness (including edge cases).
  - End-of-election settlement math.
  - Signature verification.
- Provide an integration test that simulates a small election with 3 parties, buys/sells, campaigning, voting, and settlement using mocked Octokit (or a test GitHub account).

---

## README (must include)
- Setup & environment variables (`DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `GITHUB_TOKEN`, optional `GIST_INDEX_ID`).
- How to run: `npm install`, `npm run build`, `node dist/index.js`.
- How slash commands are registered (`scripts/deploySlashCommands.ts`).
- How gists are structured and security considerations (votes in private gists).
- Notes about money supply (activity rewards minting) & how to configure activity_reward_pool or systemReserve.
- How to run tests.

---

## Developer notes / Implementation hints (for Cursor agent)

- Use `@octokit/rest` as `const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })`.
- For gist updates:
  - Read gist with `octokit.gists.get({ gist_id })`.
  - Update with `octokit.gists.update({ gist_id, files: { 'public.json': { content: JSON.stringify(newPublic, null, 2) } } })`.
- Use Node `crypto` (built-in) for RSA verification (no external dependency needed).
- Use `discord.js` interactions (CommandInteraction, ephemeral replies for balances/errors).
- Use atomic optimistic locking for gist updates (meta.version).
- Store all monetary numbers as integers in microcoins; include helper conversions functions.
- Implement a `storage/github.ts` wrapper with convenience methods: `getPublic(guildId)`, `updatePublicAtomic(guildId, transformFn)`, `appendVoteAtomic(guildId, vote)`, `createElectionGists(guildId, initialPublic)`.
- Provide an admin-only `/settle` command (or auto-run at election end) to perform settlement steps and finalize gists.

---

## Defaults & configurable options
- `DEFAULT_DURATION_HOURS = 24`
- `DEFAULT_ACTIVITY_WINDOW_HOURS = 24`
- `DEFAULT_ACTIVITY_POOL_COINS = 50`
- `MICROCOINS_PER_COIN = 1_000_000`
- `DEFAULT_ON_EMPTY_PARTY_VAULT = 'burn'` (configurable to `'admin'`)

---

## Final requirement for this run
- Produce a complete TypeScript project implementing everything above:
  - working `index.ts` that connects to Discord, registers slash commands, and handles interactions.
  - full implementations of storage/gist wrapper and economy modules.
  - at least one fully implemented example: create election, create party, buy bonds, vote, and run settlement via command (automated or manual).
  - unit tests for bonds + settlement + signature verification.
  - README and `.env.example`.

Make code production quality: typed, documented, safe against race conditions, with clear error handling and meaningful logs.
