const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const CANDIDATES_FILE = path.join(__dirname, '..', 'candidates.json');

// Load candidates from JSON file
function loadCandidates() {
    try {
        if (!fs.existsSync(CANDIDATES_FILE)) {
            return [];
        }
        const data = fs.readFileSync(CANDIDATES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading candidates file:', error);
        return [];
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('campaign')
        .setDescription('Send a campaign message as a registered candidate')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Your campaign message')
                .setRequired(true)),
    
    async execute(interaction) {
        const message = interaction.options.getString('message');
        const userId = interaction.user.id;
        const username = interaction.user.username;
        
        console.log(`📢 Campaign message attempt by user: ${username} (${userId})`);
        
        // Check if user is a registered candidate
        const candidates = loadCandidates();
        const candidate = candidates.find(c => c.userId === userId);
        
        if (!candidate) {
            await interaction.reply({
                content: `❌ **You must be a registered candidate to send campaign messages!**\n\nUse the \`/submit-candidate\` command to register your candidacy first.\n\nOnly registered candidates can broadcast campaign messages.`
            });
            console.log(`❌ User ${username} attempted to campaign without being registered candidate`);
            return;
        }
        
        // Send campaign message with candidate's registered name
        const campaignTitle = `📢 **Campaign for ${candidate.name} ${candidate.emoji}**`;
        const campaignContent = `${campaignTitle}\n\n${message}\n\n*- ${candidate.name} (@${username})*`;
        
        const reply = await interaction.reply({
            content: campaignContent,
            fetchReply: true
        });
        
        // Add upvote and downvote reactions
        try {
            await reply.react('👍');
            await reply.react('👎');
            console.log(`📢 Campaign message sent by candidate ${candidate.name} (${username}) with vote reactions`);
        } catch (error) {
            console.error('⚠️  Failed to add reactions to campaign message:', error.message);
            console.log(`📢 Campaign message sent by candidate ${candidate.name} (${username}) without reactions`);
        }
    },
};