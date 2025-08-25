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
- **Market Analytics**: Real-time bond curves and price history visualization
- **Dockerized Deployment**: Production-ready containerization

## Table of Contents

- [Setup](#setup)
  - [Quick Start with Docker](#quick-start-with-docker-)
  - [Manual Installation](#manual-installation)
- [Usage](#usage)
  - [Server Setup](#server-setup)
  - [Commands](#commands)
- [Bond Finance Mechanics](#bond-finance-mechanics)
  - [Bond Creation Process](#️-bond-creation-process)
  - [Pricing Mechanism](#-pricing-mechanism)  
  - [Fund Flow Architecture](#-fund-flow-architecture)
  - [Trading Mechanics](#-trading-mechanics)
  - [Market Analytics](#-market-analytics)
  - [Economic Incentives](#-economic-incentives)
  - [Settlement & Liquidation](#-settlement--liquidation)
  - [Risk Management](#️-risk-management)
- [System Architecture](#system-architecture)
  - [Settlement Process](#settlement-process)
  - [Data Storage](#data-storage)
  - [Money Supply](#money-supply)
  - [RSA Signature Voting](#rsa-signature-voting)
- [Security Considerations](#security-considerations)
- [Development](#development)

## Setup

### Prerequisites

- Node.js v18+ OR Docker
- Discord application with bot token
- GitHub Personal Access Token with gist permissions

### Quick Start with Docker 🐳

The easiest way to run the bot:

1. Clone and configure:
```bash
git clone <repository-url>
cd election-bot
cp .env.example .env
# Edit .env with your tokens
```

2. Run with Docker Compose:
```bash
docker-compose up -d
docker-compose exec election-bot npm run deploy-commands
```

See [DOCKER.md](DOCKER.md) for detailed Docker deployment guide.

### Manual Installation

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
- `/register <election> <publickey>` - Register RSA public key for voting in specific election
- `/vote <election> <party> <message> <signature>` - Cast your vote (requires RSA signature)

#### Bond Finance & Trading
- `/createbonds <party> <amount> <tokens> <alpha>` - Issue bonds for your party (leaders only)
- `/buybonds <party> <coins>` - Buy party bonds (invest in party success)
- `/sellbonds <party> <tokens>` - Sell bonds back to market during election
- `/plotbondcurve <party>` - Display current bond pricing curve  
- `/plotpricehistory <party>` - Show price history and recent transactions
- `/balance` - Check your current coin balance
- `/transfertoparty <party> <amount>` - Transfer coins to party vault

#### Campaign & Operations  
- `/campaign <party> <headline> <body>` - Create campaign post (costs party funds)

### Bond Finance Mechanics

ElectionBot implements a sophisticated **token-based campaign finance system** using bonding curves for price discovery and automated market making.

#### 🏗️ Bond Creation Process

**Step 1: Initialize Party Bonds**
```bash
/createbonds party:DemocratParty amount:100 tokens:50 alpha:0.7
```

- **Initial Pool**: 100 coins committed by party leader
- **Token Supply**: 50 tokens issued for trading
- **Alpha Parameter**: 0.7 (70% of purchases go to liquidity, 30% to vault)
- **Initial Price**: `pool ÷ tokens = 100 ÷ 50 = 2.0 coins/token`

#### 📈 Pricing Mechanism

**Simple Supply-Demand Model** (Updated from constant product):
- **Current Price** = `Pool ÷ Remaining Tokens`
- **After Purchase**: Price = `(Pool + New Money) ÷ (Tokens - Sold Tokens)`

**Example Price Evolution**:
1. **Initial**: 100 coins ÷ 50 tokens = 2.0 coins/token
2. **After buying 10 tokens with 25 coins**: (100 + 17.5) ÷ (50 - 10) = 2.94 coins/token
3. **Market dynamics**: More demand → Higher prices → Incentivizes early supporters

#### 💰 Fund Flow Architecture

When a user buys bonds with **X coins**:

```
User Payment (X coins)
         ↓
    Split by Alpha
         ↓
┌─────────────────┬─────────────────┐
│   Pool Fund     │   Vault Fund    │
│  (Alpha × X)    │ (1-Alpha) × X   │
│                 │                 │
│ • Price calc    │ • Campaign fund │
│ • Liquidity     │ • Operations    │
│ • Buybacks      │ • Member payouts│
└─────────────────┴─────────────────┘
```

**Alpha Parameter Effects**:
- **High Alpha (0.8-1.0)**: Liquid market, stable pricing, less campaign funds
- **Medium Alpha (0.5-0.7)**: Balanced liquidity and operations
- **Low Alpha (0.1-0.4)**: More campaign funds, volatile pricing

#### 🔄 Trading Mechanics

**Buying Bonds**:
```bash
/buybonds party:DemocratParty amount:50
```
1. User spends 50 coins
2. Pool gets `alpha × 50` coins (e.g., 35 coins if alpha=0.7)
3. Vault gets `(1-alpha) × 50` coins (e.g., 15 coins if alpha=0.7)
4. User receives tokens based on current price
5. Price increases due to reduced supply

**Selling Bonds**:
```bash
/sellbonds party:DemocratParty tokens:10
```
1. User sells 10 tokens back to the system
2. Coins refunded from pool based on current price
3. Price decreases as token supply increases
4. Only works during election period

#### 📊 Market Analytics

**Real-time Bond Curve**:
```bash
/plotbondcurve party:DemocratParty
```
- Visual ASCII chart showing price vs tokens sold
- Current market status and metrics
- Helps users understand pricing dynamics

**Historical Price Tracking**:
```bash
/plotpricehistory party:DemocratParty
```
- Time-series plot of all buy/sell transactions
- Price evolution over election period
- Market sentiment analysis

#### 🎯 Economic Incentives

**For Early Supporters**:
- Lower entry prices when buying early
- Higher potential returns if party wins
- Influence party agenda through financial stake

**For Party Leaders**:
- Campaign funding through bond sales
- Market validation of party support
- Incentive to maintain supporter confidence

**For Traders**:
- Speculation on election outcomes
- Arbitrage opportunities between parties
- Risk/reward based on political analysis

#### 🏆 Settlement & Liquidation

**During Election End**:

1. **Pool Consolidation**: All party pools merged into winner's pool
2. **Final Price Calculation**: 
   ```
   Final Price = Total Combined Pool ÷ Winning Party Total Tokens
   ```
3. **Winner Token Redemption**: 
   ```
   Payout = User's Tokens × Final Price
   ```
4. **Vault Distribution**: Each party's vault split equally among members
5. **Losing Tokens**: Become worthless (total loss)

**Example Settlement**:
```
Party A (Winner): 200 coin pool, 100 tokens issued
Party B (Loser):  150 coin pool, 75 tokens issued

Combined Pool: 350 coins
Final Price: 350 ÷ 100 = 3.5 coins/token

Party A token holder with 20 tokens gets: 20 × 3.5 = 70 coins
Party B tokens become worthless: 0 coins
```

#### ⚖️ Risk Management

**For Investors**:
- **Political Risk**: Backing losing party = total loss
- **Timing Risk**: Early vs late entry price differences  
- **Liquidity Risk**: Limited trading during election period

**For Parties**:
- **Market Confidence**: Poor performance affects fundraising
- **Alpha Selection**: Balance between liquidity and campaign funds
- **Competition**: Multiple parties competing for same investor pool

#### 🧮 Mathematical Properties

**Price Elasticity**:
- Price impact increases as tokens become scarce
- Large purchases have bigger price effects near token depletion
- Symmetric for buying/selling during active trading

**Equilibrium Dynamics**:
- Market makers balance expected election outcome vs current price
- Price discovery through collective betting on party success
- Self-reinforcing cycles: success → higher prices → more funding → better campaigns

This system creates a **prediction market** where token prices reflect real-time sentiment about each party's chances of winning, while simultaneously funding their campaigns through the vault mechanism.

## System Architecture

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
