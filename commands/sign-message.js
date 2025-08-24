const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sign-message')
        .setDescription('Get information about safely signing messages'),
    
    async execute(interaction) {
        const warningMessage = `🔒 **Important Security Warning!**

**NEVER submit your private key anywhere!** 

Private keys should remain completely confidential and never be shared with anyone, including bots, websites, or applications.

**For Safe Message Signing:**
➡️ Visit: **http://static-signer.1110777.xyz**

This static page allows you to:
✅ Sign messages securely in your browser
✅ Keep your private key completely offline
✅ Generate signatures without exposing sensitive data

**Remember:** Your private key = Your money. Keep it safe! 🛡️`;

        await interaction.reply({
            content: warningMessage
        });
        
        console.log(`🔐 Provided security warning to user: ${interaction.user.username} (${interaction.user.id})`);
    },
};