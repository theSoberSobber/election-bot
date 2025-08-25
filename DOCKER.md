# Docker Deployment Guide

## 🐳 Quick Start with Docker

### Prerequisites
- Docker and Docker Compose installed
- Discord Bot Token and Client ID
- GitHub Personal Access Token
- GitHub Gist for data storage

### 1. Clone and Setup
```bash
git clone <repository-url>
cd election-bot
cp .env.example .env
# Edit .env with your actual tokens
```

### 2. Build and Run
```bash
# Build and start with Docker Compose
docker-compose up -d

# Or build and run manually
docker build -t election-bot .
docker run -d --name election-bot --env-file .env election-bot
```

### 3. Deploy Commands
```bash
# Deploy slash commands (run once or when commands change)
docker-compose exec election-bot npm run deploy-commands
```

### 4. Monitor Logs
```bash
# View real-time logs
docker-compose logs -f election-bot

# View logs from specific time
docker-compose logs --since="1h" election-bot
```

### 5. Management Commands
```bash
# Stop the bot
docker-compose down

# Restart the bot
docker-compose restart election-bot

# Update and redeploy
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📊 Alpha Parameter Explanation

When users buy bonds with `/buybonds party amount`:

- **Pool (Liquidity)**: Gets `alpha × amount` coins
  - Used for bond price calculations
  - Enables buybacks and price stability
  
- **Vault (Treasury)**: Gets `(1-alpha) × amount` coins  
  - Party's operational funds
  - Used for campaigns and activities

**Example**: Alpha = 0.7, User spends 100 coins
- Pool receives: 70 coins (for liquidity)
- Vault receives: 30 coins (for party operations)

## 🏗️ Architecture

- **Alpine Linux**: Minimal, secure base image
- **Node.js 22.18.0**: Latest LTS with performance improvements
- **Non-root user**: Security best practice
- **Health checks**: Container monitoring
- **Volume mounts**: Persistent logs

## 🔧 Configuration

Environment variables in `.env`:
- `DISCORD_TOKEN`: Bot authentication
- `DISCORD_CLIENT_ID`: Application ID
- `GITHUB_TOKEN`: Data storage access
- `GITHUB_USERNAME`: GitHub account
- `GITHUB_GIST_ID`: Data storage location

## 📈 Monitoring

The bot includes:
- Health check endpoint
- Structured logging
- Error handling
- Graceful shutdown

## 🚀 Production Deployment

For production use:
1. Use secrets management instead of .env files
2. Set up log aggregation
3. Configure monitoring alerts
4. Use reverse proxy if exposing HTTP endpoints
5. Regular backups of GitHub Gist data
