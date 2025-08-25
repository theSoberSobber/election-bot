import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { Collection } from 'discord.js';
import { SlashCommand } from '../src/types';
import { initializeCommands } from '../src/commands';

config();

async function deployCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    console.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment variables');
    process.exit(1);
  }

  const commands = new Collection<string, SlashCommand>();
  await initializeCommands(commands);

  const commandData = commands.map(command => command.data.toJSON());

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('Started refreshing application (/) commands.');

    // Deploy globally (remove guildId parameter for global deployment)
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commandData }
    );

    console.log('Successfully reloaded application (/) commands.');
    console.log(`Deployed ${commandData.length} commands:`, commandData.map(cmd => cmd.name));
  } catch (error) {
    console.error('Error deploying commands:', error);
  }
}

deployCommands();
