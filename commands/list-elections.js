const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const ELECTIONS_FILE = path.join(__dirname, '..', 'elections.json');

// Load elections from JSON file
function loadElections() {
    try {
        if (!fs.existsSync(ELECTIONS_FILE)) {
            return {};
        }
        const data = fs.readFileSync(ELECTIONS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading elections file:', error);
        return {};
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list-elections')
        .setDescription('View all available elections'),
    
    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        
        console.log(`📋 Elections list requested by user: ${username}`);
        
        // Load elections
        const elections = loadElections();
        const electionNames = Object.keys(elections);
        
        if (electionNames.length === 0) {
            await interaction.reply({
                content: `📋 **No Elections Available**\n\nThere are currently no active elections.\n\n👤 Users with the \`electionBotAdmin\` role can create elections using \`/create-election\`.`
            });
            return;
        }
        
        // Build elections list
        let electionsList = '📊 **Available Elections**\n\n';
        
        for (const name of electionNames) {
            const election = elections[name];
            const createdDate = new Date(election.createdAt);
            const createdTimestamp = Math.floor(createdDate.getTime() / 1000);
            
            // Get current status
            let currentStatus = election.status;
            if (election.startTime && election.endTime) {
                const startTime = new Date(election.startTime);
                const endTime = new Date(election.endTime);
                const now = new Date();
                
                if (now < startTime) {
                    currentStatus = 'upcoming';
                } else if (now >= startTime && now <= endTime) {
                    currentStatus = 'active';
                } else {
                    currentStatus = 'ended';
                }
                
                const startTimestamp = Math.floor(startTime.getTime() / 1000);
                const endTimestamp = Math.floor(endTime.getTime() / 1000);
                
                electionsList += `🗳️  **${election.name}**\n`;
                electionsList += `   👤 Created by: <@${election.createdBy}>\n`;
                electionsList += `   🕒 Created: <t:${createdTimestamp}:R>\n`;
                electionsList += `   ⏰ Starts: <t:${startTimestamp}:f> (<t:${startTimestamp}:R>)\n`;
                electionsList += `   ⏰ Ends: <t:${endTimestamp}:f> (<t:${endTimestamp}:R>)\n`;
                electionsList += `   📏 Duration: ${election.duration || 'N/A'}\n`;
                electionsList += `   📊 Status: ${getStatusEmoji(currentStatus)} ${currentStatus}\n\n`;
            } else {
                // Legacy election without timing
                electionsList += `🗳️  **${election.name}**\n`;
                electionsList += `   👤 Created by: <@${election.createdBy}>\n`;
                electionsList += `   🕒 Created: <t:${createdTimestamp}:R>\n`;
                electionsList += `   📊 Status: ${getStatusEmoji(currentStatus)} ${currentStatus}\n\n`;
            }
        }
        
        function getStatusEmoji(status) {
            switch(status) {
                case 'upcoming': return '⏳';
                case 'active': return '🟢';
                case 'ended': return '🔴';
                default: return '❓';
            }
        }
        
        electionsList += `\n💡 **To participate:**\n`;
        electionsList += `• Use \`/submit-key\` to register your RSA key\n`;
        electionsList += `• Use \`/submit-candidate\` to run for office\n`;
        electionsList += `• Use \`/vote\` to cast your ballot\n`;
        electionsList += `• Use \`/campaign\` to send campaign messages\n\n`;
        electionsList += `⚠️  All commands now require an election name parameter!`;
        
        await interaction.reply({
            content: electionsList
        });
        
        console.log(`✅ Displayed ${electionNames.length} elections to ${username}`);
    },
};