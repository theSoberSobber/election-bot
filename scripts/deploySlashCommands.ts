import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { Collection } from 'discord.js';
import { SlashCommand } from '../src/types';
import { initializeCommands } from '../src/commands';

config();

async function deployCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token) {
    console.error('❌ DISCORD_TOKEN not found in environment variables!');
    process.exit(1);
  }

  if (!clientId) {
    console.error('❌ DISCORD_CLIENT_ID not found in environment variables!');
    process.exit(1);
  }

  console.log('🔧 Loading commands...');
  const commands = new Collection<string, SlashCommand>();
  await initializeCommands(commands);

  const commandData = commands.map(command => {
    console.log(`✅ Loaded command for deployment: ${command.data.name}`);
    return command.data.toJSON();
  });

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log(`🚀 Started refreshing ${commands.size} application (/) commands.`);

    // Deploy globally (remove guildId parameter for global deployment)
    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commandData }
    ) as any[];

    console.log(`✅ Successfully reloaded ${data.length} application (/) commands globally.`);
    console.log('📝 Note: Global commands may take up to 1 hour to appear in all servers.');
    console.log('Deployed commands:', data.map(cmd => cmd.name).join(', '));
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
    process.exit(1);
  }
}

deployCommands();
