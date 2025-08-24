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

// Load candidates from election-specific JSON file
function loadCandidates(electionName) {
    const candidatesFile = path.join(__dirname, '..', `candidates-${electionName}.json`);
    try {
        if (!fs.existsSync(candidatesFile)) {
            return [];
        }
        const data = fs.readFileSync(candidatesFile, 'utf8');
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
            option.setName('election')
                .setDescription('Name of the election')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Your campaign message')
                .setRequired(true)),
    
    async execute(interaction) {
        const electionName = interaction.options.getString('election');
        const message = interaction.options.getString('message');
        const userId = interaction.user.id;
        const username = interaction.user.username;
        
        console.log(`📢 Campaign message attempt by user: ${username} for election: ${electionName}`);
        
        // Check if election exists
        const elections = loadElections();
        if (!elections[electionName]) {
            await interaction.reply({
                content: `❌ **Election not found!**\n\nThe election \`${electionName}\` does not exist.\n\nUse \`/list-elections\` to see available elections.`,
                ephemeral: true
            });
            return;
        }
        
        // Check if user is a registered candidate for this election
        const candidates = loadCandidates(electionName);
        const candidate = candidates.find(c => c.userId === userId);
        
        if (!candidate) {
            await interaction.reply({
                content: `❌ **You must be a registered candidate to send campaign messages!**\n\nUse the \`/submit-candidate\` command to register your candidacy first.\n\nOnly registered candidates can broadcast campaign messages.`
            });
            console.log(`❌ User ${username} attempted to campaign without being registered candidate`);
            return;
        }
        
        // Send campaign message with candidate's registered name
        const campaignTitle = `📢 **Campaign for ${candidate.name} ${candidate.emoji}** (Election: \`${electionName}\`)`;
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