import { Client, GatewayIntentBits, Collection, Events, ActivityType } from 'discord.js';
import { config } from 'dotenv';
import { SlashCommand } from './types';
import { initializeCommands } from './commands';
import { initializeGithubStorage } from './storage/github';

config();

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// Create a collection to store commands
const commands = new Collection<string, SlashCommand>();

// Initialize everything synchronously like the working version
async function initializeBot() {
  try {
    console.log('🔧 Initializing GitHub storage...');
    await initializeGithubStorage();
    console.log('✅ GitHub storage initialized');
    
    console.log('🔧 Loading commands...');
    await initializeCommands(commands);
    console.log(`✅ Loaded ${commands.size} commands:`);
    
    // Log each loaded command like the working version
    commands.forEach(command => {
      console.log(`   - ${command.data.name}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to initialize:', error);
    process.exit(1);
  }
}

// Start initialization
initializeBot();

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, readyClient => {
  console.log(`🚀 Bot is online! Logged in as ${readyClient.user.tag}`);
  console.log(`📊 Serving ${readyClient.guilds.cache.size} servers`);
  
  // Set bot activity status
  readyClient.user.setActivity('Managing elections & campaigns', { type: ActivityType.Playing });
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
    
    // Handle interaction timeout errors gracefully
    if (error && typeof error === 'object' && 'code' in error && error.code === 10062) {
      console.log('⚠️  Interaction expired - this is normal for long-running commands');
      return;
    }
    
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
      const errorMsg = replyError instanceof Error ? replyError.message : String(replyError);
      console.error('❌ Failed to send error message (interaction may have expired):', errorMsg);
    }
  }
});

// Handle errors
client.on(Events.Error, error => {
  console.error('❌ Discord client error:', error);
});

client.on(Events.Warn, warning => {
  console.warn('⚠️  Discord client warning:', warning);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

// Get bot token from environment variables
const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('❌ DISCORD_TOKEN not found in environment variables!');
  console.error('Please set your bot token in the environment variables.');
  process.exit(1);
}

// Log in to Discord with your client's token
client.login(token).catch(error => {
  console.error('❌ Failed to login to Discord:', error);
  process.exit(1);
});
