# Discord Bot Project

## Overview

This is a Discord bot built with Node.js and Discord.js v14. The bot implements a slash command system with a modular architecture that allows for easy command management and deployment. Currently, it includes a basic ping command that measures bot and API latency. The bot is designed to be scalable and maintainable, with clear separation between command logic and the main bot functionality.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Bot Framework
- **Discord.js v14**: Modern Discord API wrapper providing comprehensive bot functionality
- **Slash Commands**: Uses Discord's native slash command system for user interactions
- **Event-driven Architecture**: Handles Discord events through registered event listeners

### Command System
- **Modular Command Structure**: Commands are stored as separate modules in the `/commands` directory
- **Dynamic Command Loading**: Commands are automatically loaded from the filesystem at startup
- **Command Collection**: Uses Discord.js Collections for efficient command storage and retrieval
- **Standardized Command Interface**: Each command must export `data` (SlashCommandBuilder) and `execute` function

### Application Structure
- **Main Bot File (`index.js`)**: Handles client initialization, command loading, and event handling
- **Command Deployment (`deploy-commands.js`)**: Separate script for registering slash commands with Discord API
- **Environment Configuration**: Uses dotenv for secure credential management

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