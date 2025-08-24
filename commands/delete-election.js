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
        .setName('delete-election')
        .setDescription('[ADMIN] Delete an existing election')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name of the election to delete')
                .setRequired(true)),
    
    async execute(interaction) {
        const electionName = interaction.options.getString('name');
        const userId = interaction.user.id;
        const username = interaction.user.username;
        
        console.log(`🗑️  Election deletion attempt by user: ${username} (${userId})`);
        
        // Check if user has electionBotAdmin role
        const member = interaction.member;
        const hasAdminRole = member.roles.cache.some(role => role.name === 'electionBotAdmin');
        
        if (!hasAdminRole) {
            await interaction.reply({
                content: `❌ **Access Denied**\n\nYou need the \`electionBotAdmin\` role to delete elections.\n\nOnly authorized administrators can manage elections.`,
                ephemeral: true
            });
            console.log(`❌ User ${username} attempted to delete election without admin role`);
            return;
        }
        
        // Load existing elections
        const elections = loadElections();
        
        // Check if election exists
        if (!elections[electionName]) {
            await interaction.reply({
                content: `❌ **Election Not Found**\n\nNo election named \`${electionName}\` exists.\n\nUse \`/list-elections\` to see available elections.`,
                ephemeral: true
            });
            return;
        }
        
        // Store election info for confirmation message
        const election = elections[electionName];
        
        // Delete the election
        delete elections[electionName];
        
        // Save elections
        if (saveElections(elections)) {
            await interaction.reply({
                content: `✅ **Election Deleted Successfully!**\n\n🗑️  **Deleted:** \`${electionName}\`\n👤 **Originally created by:** <@${election.createdBy}>\n🕒 **Was created:** <t:${Math.floor(new Date(election.createdAt).getTime() / 1000)}:f>\n\n⚠️  **Note:** Election data in GitHub repository remains intact.\nUse \`/reset-bot\` to completely clear all GitHub data if needed.`
            });
            console.log(`✅ Election '${electionName}' deleted successfully by admin ${username}`);
        } else {
            await interaction.reply({
                content: `❌ **Failed to Delete Election**\n\nThere was an error saving the election data. Please try again.`,
                ephemeral: true
            });
            console.error(`❌ Failed to delete election '${electionName}' by ${username}`);
        }
    },
};