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
            const timestamp = Math.floor(createdDate.getTime() / 1000);
            
            electionsList += `🗳️  **${election.name}**\n`;
            electionsList += `   👤 Created by: <@${election.createdBy}>\n`;
            electionsList += `   🕒 Created: <t:${timestamp}:R>\n`;
            electionsList += `   📊 Status: ${election.status}\n\n`;
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