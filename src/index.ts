import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { config } from 'dotenv';
import { SlashCommand } from './types';
import { initializeCommands } from './commands';
import { initializeGithubStorage } from './storage/github';

config();

// Create a new client instance
const client = new Client({
  intents: []
});

// Create a collection to store commands
const commands = new Collection<string, SlashCommand>();

// Initialize everything synchronously like the working version
async function initializeBot() {
  try {
    await initializeGithubStorage();
    await initializeCommands(commands);
    console.log(`Loaded ${commands.size} commands`);
  } catch (error) {
    console.error('Failed to initialize:', error);
    process.exit(1);
  }
}

// Start initialization
initializeBot();

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, readyClient => {
  console.log(`🚀 Bot is online! Logged in as ${readyClient.user.tag}`);
  console.log(`📊 Serving ${readyClient.guilds.cache.size} servers`);
});

// Handle slash command interactions
client.on(Events.InteractionCreate, async interaction => {
  // Only handle slash commands
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    console.error(`❌ No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    console.log(`🔧 Executing command: ${interaction.commandName} by ${interaction.user.tag}`);
    await command.execute(interaction);
  } catch (error) {
    console.error(`❌ Error executing command ${interaction.commandName}:`, error);
    
    const errorMessage = {
      content: 'There was an error while executing this command!',
      ephemeral: true
    };

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    } catch (replyError) {
      console.error('❌ Failed to send error message:', replyError);
    }
  }
});

// Handle errors
client.on(Events.Error, error => {
  console.error('❌ Discord client error:', error);
});

// Get bot token from environment variables
const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('❌ DISCORD_TOKEN not found in environment variables!');
  process.exit(1);
}

// Log in to Discord with your client's token
client.login(token).catch(error => {
  console.error('❌ Failed to login to Discord:', error);
  process.exit(1);
});
