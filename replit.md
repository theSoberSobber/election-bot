# Discord Bot Project

## Overview

This is a comprehensive Discord election bot built with Node.js and Discord.js v14. The bot implements a complete election system with RSA key validation, GitHub integration for transparency, voting capabilities, candidate registration, and campaign messaging. It features a multi-election system where administrators can create and manage multiple concurrent elections, with role-based access controls and secure data handling through GitHub repositories.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Bot Framework
- **Discord.js v14**: Modern Discord API wrapper providing comprehensive bot functionality
- **Slash Commands**: Uses Discord's native slash command system for user interactions
- **Event-driven Architecture**: Handles Discord events through registered event listeners
- **Role-Based Access Control**: Admin commands restricted to users with `electionBotAdmin` role
- **Multi-Election Support**: Concurrent elections with isolated data and operations

### Command System
- **Modular Command Structure**: Commands are stored as separate modules in the `/commands` directory
- **Dynamic Command Loading**: Commands are automatically loaded from the filesystem at startup
- **Command Collection**: Uses Discord.js Collections for efficient command storage and retrieval
- **Standardized Command Interface**: Each command must export `data` (SlashCommandBuilder) and `execute` function
- **Election-Specific Operations**: All user commands require election name parameter for data isolation

### Election Management System
- **Admin-Only Controls**: Election creation, deletion, and bot reset restricted to admin role
- **Election Lifecycle**: Create elections, register users/candidates, conduct voting, manage campaigns
- **Data Isolation**: Each election maintains separate user keys, candidates, and votes
- **GitHub Integration**: All election data stored in organized GitHub repository structure

### Application Structure
- **Main Bot File (`index.js`)**: Handles client initialization, command loading, and event handling
- **Command Deployment (`deploy-commands.js`)**: Separate script for registering slash commands with Discord API
- **Environment Configuration**: Uses dotenv for secure credential management
- **Election Data Files**: Election-specific JSON files for local data (`elections.json`, `users-{election}.json`, `candidates-{election}.json`, `votes-{election}.json`)
- **GitHub Repository Structure**: Organized folders per election (`/elections/{election-name}/users/`, `/elections/{election-name}/candidates/`, `/elections/{election-name}/votes/`)

### Error Handling
- **Graceful Command Loading**: Validates command structure before loading
- **Runtime Error Management**: Catches and logs interaction errors without crashing the bot
- **Configuration Validation**: Checks for required environment variables at startup

### Development Features
- **Hot Command Deployment**: Commands can be updated without restarting the bot
- **Detailed Logging**: Comprehensive console output for debugging and monitoring
- **Status Management**: Bot activity status reflects current functionality

## External Dependencies

### Core Dependencies
- **Discord.js (^14.22.1)**: Primary Discord API library for bot functionality
- **dotenv (^17.2.1)**: Environment variable management for configuration

### Discord API Integration
- **Discord Developer Portal**: Bot registration and token management
- **Slash Command Registration**: Global command deployment through Discord REST API
- **Gateway Intents**: Configured for guild and message access

### Environment Variables
- **DISCORD_TOKEN**: Bot authentication token from Discord Developer Portal
- **DISCORD_CLIENT_ID**: Application ID for command registration

### Runtime Requirements
- **Node.js (>=16.11.0)**: Required by Discord.js for modern JavaScript features
- **File System Access**: Dynamic command loading from local directory structure