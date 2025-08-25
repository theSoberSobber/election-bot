# Discord Election Bot

A comprehensive Discord election bot built with Node.js and Discord.js v14. This bot implements a complete election system with RSA key validation, GitHub integration for transparency, voting capabilities, candidate registration, and campaign messaging.

## Features

- 🗳️ **Multi-Election System**: Create and manage multiple concurrent elections
- 🔐 **RSA Key Validation**: Secure cryptographic voting with user-submitted public keys
- 📊 **GitHub Transparency**: All data stored in public GitHub repositories for full transparency
- 👤 **Candidate Registration**: Users can submit candidacy with emoji, name, and agenda
- 📢 **Campaign Messaging**: Registered candidates can send campaign messages with voting reactions
- 🎯 **Role-Based Access**: Admin-only controls for election management
- ⏰ **Scheduled Elections**: Support for timed elections with start/end dates

## System Architecture

### Three-Repository Structure

1. **Main Bot Repository** (this repo): Contains the bot code and commands
2. **Public-Keys Repository**: Stores user RSA keys and candidate information
3. **Votes Repository**: Stores all submitted votes

The bot uses GitHub's REST API to directly manage files in the external repositories **without any local cloning**. This ensures clean deployments and eliminates local storage issues.

### Command Overview

- `/ping` - Test bot responsiveness
- `/create-election` - [ADMIN] Create new elections with optional timing
- `/delete-election` - [ADMIN] Delete existing elections
- `/list-elections` - View all available elections
- `/submit-key` - Register your RSA public key for an election
- `/submit-candidate` - Register as a candidate with name, emoji, and agenda
- `/list-candidates` - View all candidates for an election
- `/campaign` - Send campaign messages (candidates only)
- `/vote` - Submit your cryptographically signed vote
- `/sign-message` - Get information about safely signing messages
- `/reset-bot` - [ADMIN] Complete system reset

## Setup Instructions

### Prerequisites

- Node.js 16.11.0 or higher
- Discord Developer Application with Bot Token
- GitHub Personal Access Token with repo permissions
- Two GitHub repositories for data storage

### Installation

1. **Clone this repository**
   ```bash
   git clone <your-repo-url>
   cd discord-election-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   ```env
   DISCORD_TOKEN=your_discord_bot_token
   DISCORD_CLIENT_ID=your_discord_application_id
   GITHUB_PERSONAL_ACCESS_TOKEN=your_github_token
   ```

4. **GitHub Repository Setup**
   
   Create two repositories on GitHub:
   - `Public-Keys` - For storing user keys and candidate info
   - `Votes` - For storing submitted votes
   
   Update the repository URLs in the code:
   - `commands/submit-key.js` - Update `theSoberSobber/Public-Keys`
   - `commands/submit-candidate.js` - Update `theSoberSobber/Public-Keys`
   - `commands/vote.js` - Update `theSoberSobber/Votes`

5. **Deploy Discord Commands**
   ```bash
   node deploy-commands.js
   ```

6. **Start the Bot**
   ```bash
   node index.js
   ```

### Discord Setup

1. Create a Discord application at [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a bot and get the token
3. Add the bot to your server with required permissions:
   - Send Messages
   - Use Slash Commands
   - Add Reactions
   - Read Message History

### Required Discord Role

Create a role named `electionBotAdmin` in your Discord server for users who should be able to:
- Create elections
- Delete elections
- Reset the bot system

## Configuration

### GitHub Integration

The bot requires a GitHub Personal Access Token with the following permissions:
- `repo` (Full control of private repositories)
- `public_repo` (Access public repositories)

### Repository Structure

**Public-Keys Repository:**
```
elections/
  {election-name}/
    users/
      {user-id}/
        public_key.pem
        info.json
    candidates/
      {user-id}.json
```

**Votes Repository:**
```
elections/
  {election-name}/
    votes/
      {user-id}.txt
```

## Usage Guide

### For Administrators

1. **Create an Election**
   ```
   /create-election name:presidential-2024 start:2024-12-01 08:00 duration:7d
   ```

2. **Monitor Elections**
   ```
   /list-elections
   ```

3. **Clean Up**
   ```
   /delete-election name:old-election
   /reset-bot confirm:RESET-EVERYTHING  # Full system reset
   ```

### For Users

1. **Register to Vote**
   ```
   /submit-key election:presidential-2024 publickey:[your-rsa-public-key]
   ```

2. **Run for Office**
   ```
   /submit-candidate election:presidential-2024 name:"John Doe" emoji:🎯 agenda:"My platform"
   ```

3. **Campaign**
   ```
   /campaign election:presidential-2024 message:"Vote for me!"
   ```

4. **Vote**
   ```
   /vote election:presidential-2024 signed-message:[your-signed-message]
   ```

## Security Features

- **Cryptographic Voting**: Uses RSA signatures for vote authenticity
- **GitHub Transparency**: All data publicly viewable on GitHub
- **Role-Based Access**: Admin functions restricted to authorized users
- **Remote-Only Operations**: No local repository cloning - works entirely via GitHub API
- **Transactional Operations**: GitHub operations must succeed before local storage

## Development

### Project Structure

```
├── commands/           # Slash command implementations
├── index.js           # Main bot file
├── deploy-commands.js # Command deployment script
├── package.json       # Dependencies and scripts
├── .env.example       # Environment template
└── .gitignore        # Git ignore rules
```

### Adding New Commands

1. Create a new file in the `commands/` directory
2. Export an object with `data` and `execute` properties
3. Re-run `deploy-commands.js` to register with Discord

### Local Development

The bot works entirely through GitHub's REST API and maintains minimal local state:
- Local JSON files for quick command responses (these are excluded from git)
- No local repository clones needed
- Clean deployments with no repository management overhead

## Troubleshooting

### Common Issues

1. **GitHub Authentication Errors**
   - Verify your `GITHUB_PERSONAL_ACCESS_TOKEN` has correct permissions
   - Check that the repositories exist and are accessible

2. **Discord Command Not Appearing**
   - Global commands take up to 1 hour to propagate
   - Use guild-specific commands for faster testing

3. **Bot Not Responding**
   - Check the console for error messages
   - Verify all environment variables are set correctly

### Logs

The bot provides comprehensive logging for all operations. Check the console output for:
- Command executions
- GitHub operations
- Error details and suggestions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License - see the package.json file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review console logs for detailed error messages
3. Create an issue on GitHub with relevant log output
