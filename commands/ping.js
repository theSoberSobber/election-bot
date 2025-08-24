const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
    
    async execute(interaction) {
        // Calculate bot latency
        const sent = await interaction.reply({ 
            content: 'Pinging...', 
            fetchReply: true 
        });
        
        const timeDiff = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);
        
        // Edit the reply with the actual response
        await interaction.editReply({
            content: `🏓 **Pong!**\n\`\`\`yaml\nBot Latency: ${timeDiff}ms\nAPI Latency: ${apiLatency}ms\n\`\`\``
        });
        
        console.log(`📊 Ping command executed - Bot: ${timeDiff}ms, API: ${apiLatency}ms`);
    },
};
