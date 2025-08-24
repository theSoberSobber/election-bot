const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

// Get configuration from environment variables
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

// Load all commands
const commands = [];
const foldersPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(foldersPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(foldersPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`✅ Loaded command for deployment: ${command.data.name}`);
    } else {
        console.log(`⚠️  The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// Deploy commands
(async () => {
    try {
        console.log(`🚀 Started refreshing ${commands.length} application (/) commands.`);

        // Register commands globally (takes up to 1 hour to propagate)
        // For faster testing, you can use guild-specific commands by uncommenting below
        // and replacing 'guildId' with your test server's ID
        
        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        // For guild-specific deployment (faster for testing):
        // const guildId = process.env.DISCORD_GUILD_ID;
        // const data = await rest.put(
        //     Routes.applicationGuildCommands(clientId, guildId),
        //     { body: commands },
        // );

        console.log(`✅ Successfully reloaded ${data.length} application (/) commands globally.`);
        console.log('📝 Note: Global commands may take up to 1 hour to appear in all servers.');
        
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
})();
