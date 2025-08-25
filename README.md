# ElectionBot

A Discord bot for running democratic elections with token-based campaign finance using GitHub Gists for persistent storage.

## Features

- **Democratic Elections**: Create time-bound elections with multiple parties
- **Token-Based Finance**: Parties can issue bonds with bonding curve mechanics
- **Cryptographic Voting**: RSA signature-based vote verification
- **Campaign System**: Spend campaign funds to promote your party
- **GitHub Gist Storage**: All data stored remotely in GitHub Gists (no local database)
- **Party Management**: Create parties, join/leave, manage agendas
- **Settlement**: Automatic end-of-election token liquidation and fund distribution

## Setup

### Prerequisites

- Node.js v18+
- Discord application with bot token
- GitHub Personal Access Token with gist permissions

### Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd election-bot
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
GITHUB_TOKEN=your_github_personal_access_token_here

# Optional configuration
DEFAULT_DURATION_HOURS=24
DEFAULT_ACTIVITY_WINDOW_HOURS=24
DEFAULT_ACTIVITY_POOL_COINS=50
MICROCOINS_PER_COIN=1000000
DEFAULT_ON_EMPTY_PARTY_VAULT=burn
```

4. Build the project:
```bash
npm run build
```

5. Deploy slash commands:
```bash
npm run deploy-commands
```

6. Start the bot:
```bash
npm start
```

## Usage

### Server Setup

1. Create a role named exactly `electionBotAdmin` in your Discord server
2. Assign this role to users who should be able to create/delete elections

### Commands

#### Election Management (Admin Only)
- `/create [start] [duration]` - Create a new election
- `/delete` - Delete the current election
- `/listparties` - List all parties in current election

#### Party Management
- `/createparty <name> <emoji> <agenda>` - Create a political party
- `/joinparty <party>` - Request to join a party (requires leader approval)
- `/createbonds <party> <amount> <tokens> <alpha>` - Issue bonds for your party

#### Voting & Participation
- `/register <publickey>` - Register RSA public key for voting
- `/vote <party> <message> <signature>` - Cast your vote (requires RSA signature)
- `/buybonds <party> <coins>` - Buy party bonds
- `/campaign <party> <headline> <body>` - Create campaign post (costs party funds)

### Bond Economics

The bot implements a **constant product bonding curve** for party financing:

- **Initial Setup**: Party leader commits P coins and issues N tokens → `k = P × N`
- **Token Price**: Current price = `k ÷ remaining_tokens`
- **Purchase Split**: When buying with coins, `alpha` portion goes to pool, `(1-alpha)` goes to vault
- **Pool**: Used for token price discovery
- **Vault**: Accumulated campaign funds, distributed to members at election end

### Settlement Process

When an election ends:

1. **Pool Merger**: All party bond pools are combined
2. **Winner Price**: `final_price = combined_pool ÷ winning_party_issued_tokens`
3. **Token Liquidation**: Winning token holders get `tokens × final_price`
4. **Unsold Tokens**: Added to winning party's vault at final price
5. **Vault Distribution**: Each party's vault split equally among members
6. **Losing Tokens**: Become worthless

### Data Storage

All data is stored in **GitHub Gists**:

- **Public Gist** (`public.json`): Election state, parties, balances, registrations
- **Private Gist** (`private_votes.json`): Votes (kept secret until election ends)
- **Gist Index**: Maps Discord servers to their election gists

### Money Supply

- **Base Balance**: Every user starts with 100 coins
- **Activity Rewards**: Optional periodic distribution based on message activity
- **Bond Trading**: Zero-sum between users
- **Campaign Spending**: Burns coins from party vaults

Configure activity rewards:
- Set `DEFAULT_ACTIVITY_POOL_COINS=0` to disable minting
- Use `systemReserve` mode to distribute from fixed pool instead of minting

### RSA Signature Voting

To vote, users must:

1. Generate RSA key pair
2. Register public key with `/register`
3. Sign party name with private key
4. Submit vote with `/vote <party> <party> <signature>`

Example with OpenSSL:
```bash
# Generate key pair
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# Sign message
echo -n "PartyName" | openssl dgst -sha256 -sign private.pem | base64
```

## Security Considerations

- **Gist Privacy**: Private gists are "secret" but not encrypted. Vote confidentiality depends on gist URL secrecy
- **Admin Role**: `electionBotAdmin` role has full election control
- **RSA Keys**: Users must keep private keys secure; no key recovery mechanism
- **Rate Limits**: GitHub API limits may affect high-activity servers
- **Atomic Updates**: Uses optimistic locking to prevent race conditions in gist updates

## Development

### Running Tests

```bash
npm test
```

### Development Mode

```bash
npm run dev
```

### Project Structure

```
src/
├── index.ts              # Bot entry point
├── types.ts              # TypeScript type definitions
├── commands/             # Slash command implementations
│   ├── createElection.ts
│   ├── createParty.ts
│   ├── vote.ts
│   └── ...
├── storage/
│   └── github.ts         # GitHub Gist storage wrapper
├── economy/
│   ├── bonds.ts          # Bonding curve mathematics
│   └── settlement.ts     # End-of-election settlement
└── utils/
    ├── crypto.ts         # RSA signature verification
    ├── permissions.ts    # Role-based access control
    └── numbers.ts        # Safe decimal arithmetic
```

## Configuration Options

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_DURATION_HOURS` | 24 | Default election duration |
| `DEFAULT_ACTIVITY_WINDOW_HOURS` | 24 | Activity tracking window |
| `DEFAULT_ACTIVITY_POOL_COINS` | 50 | Coins per activity period |
| `MICROCOINS_PER_COIN` | 1000000 | Internal precision (1 coin = 1M microcoins) |
| `DEFAULT_ON_EMPTY_PARTY_VAULT` | burn | What to do with empty party vaults |

## Troubleshooting

### Common Issues

1. **Commands not appearing**: Run `npm run deploy-commands`
2. **Permission denied**: Ensure user has `electionBotAdmin` role
3. **GitHub API errors**: Check token permissions and rate limits
4. **Invalid signatures**: Verify RSA key format and signing process

### Logs

The bot logs important events to console. Check for:
- GitHub API errors
- Signature verification failures
- Gist update conflicts
- Command execution errors

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review bot logs for error messages
3. Create an issue in the repository
