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

// Save elections to JSON file
function saveElections(elections) {
    try {
        fs.writeFileSync(ELECTIONS_FILE, JSON.stringify(elections, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving elections file:', error);
        return false;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create-election')
        .setDescription('[ADMIN] Create a new election')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name of the election (no spaces, use dashes)')
                .setRequired(true)),
    
    async execute(interaction) {
        const electionName = interaction.options.getString('name');
        const userId = interaction.user.id;
        const username = interaction.user.username;
        
        console.log(`🗳️  Election creation attempt by user: ${username} (${userId})`);
        
        // Check if user has electionBotAdmin role
        const member = interaction.member;
        const hasAdminRole = member.roles.cache.some(role => role.name === 'electionBotAdmin');
        
        if (!hasAdminRole) {
            await interaction.reply({
                content: `❌ **Access Denied**\n\nYou need the \`electionBotAdmin\` role to create elections.\n\nOnly authorized administrators can manage elections.`,
                ephemeral: true
            });
            console.log(`❌ User ${username} attempted to create election without admin role`);
            return;
        }
        
        // Validate election name (no spaces, special chars)
        if (!/^[a-zA-Z0-9-_]+$/.test(electionName)) {
            await interaction.reply({
                content: `❌ **Invalid Election Name**\n\nElection names can only contain letters, numbers, dashes (-), and underscores (_).\n\nExample: \`presidential-election-2024\``,
                ephemeral: true
            });
            return;
        }
        
        // Load existing elections
        const elections = loadElections();
        
        // Check if election already exists
        if (elections[electionName]) {
            await interaction.reply({
                content: `❌ **Election Already Exists**\n\nAn election named \`${electionName}\` already exists.\n\nChoose a different name or delete the existing election first.`,
                ephemeral: true
            });
            return;
        }
        
        // Create new election
        elections[electionName] = {
            name: electionName,
            createdBy: userId,
            createdAt: new Date().toISOString(),
            status: 'active'
        };
        
        // Save elections
        if (saveElections(elections)) {
            await interaction.reply({
                content: `✅ **Election Created Successfully!**\n\n📊 **Election:** \`${electionName}\`\n👤 **Created by:** ${username}\n🕒 **Created:** <t:${Math.floor(Date.now() / 1000)}:f>\n\n🎯 Users can now:\n• Submit RSA keys for this election\n• Register as candidates\n• Vote (when ready)\n• Send campaign messages\n\nAll commands now require the election name parameter!`
            });
            console.log(`✅ Election '${electionName}' created successfully by admin ${username}`);
        } else {
            await interaction.reply({
                content: `❌ **Failed to Create Election**\n\nThere was an error saving the election data. Please try again.`,
                ephemeral: true
            });
            console.error(`❌ Failed to save election '${electionName}' created by ${username}`);
        }
    },
};