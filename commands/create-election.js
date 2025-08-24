const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const ELECTIONS_FILE = path.join(__dirname, '..', 'elections.json');

// Parse duration string to milliseconds
function parseDuration(durationStr) {
    const match = durationStr.match(/^(\d+)([hdwm])$/);
    if (!match) return null;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    const multipliers = {
        'h': 60 * 60 * 1000,      // hours
        'd': 24 * 60 * 60 * 1000, // days
        'w': 7 * 24 * 60 * 60 * 1000, // weeks
        'm': 30 * 24 * 60 * 60 * 1000  // months (approx)
    };
    
    return value * multipliers[unit];
}

// Get election status based on current time
function getElectionStatus(startTime, endTime) {
    const now = new Date();
    if (now < startTime) {
        return 'upcoming';
    } else if (now >= startTime && now <= endTime) {
        return 'active';
    } else {
        return 'ended';
    }
}

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
                .setRequired(true))
        .addStringOption(option =>
            option.setName('start')
                .setDescription('Start time (YYYY-MM-DD HH:MM or leave empty for now)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Election duration (e.g., 24h, 7d, 2w - default: 24h)')
                .setRequired(false)),
    
    async execute(interaction) {
        const electionName = interaction.options.getString('name');
        const startInput = interaction.options.getString('start');
        const durationInput = interaction.options.getString('duration') || '24h';
        const userId = interaction.user.id;
        const username = interaction.user.username;
        
        console.log(`🗳️  Election creation attempt by user: ${username} (${userId})`);
        
        // Check if user has electionBotAdmin role
        const member = interaction.member;
        const hasAdminRole = member.roles.cache.some(role => role.name === 'electionBotAdmin');
        
        if (!hasAdminRole) {
            await interaction.reply({
                content: `❌ **Access Denied**\n\nYou need the \`electionBotAdmin\` role to create elections.\n\nOnly authorized administrators can manage elections.`,
                flags: 64 // Ephemeral flag
            });
            console.log(`❌ User ${username} attempted to create election without admin role`);
            return;
        }
        
        // Validate election name (no spaces, special chars)
        if (!/^[a-zA-Z0-9-_]+$/.test(electionName)) {
            await interaction.reply({
                content: `❌ **Invalid Election Name**\n\nElection names can only contain letters, numbers, dashes (-), and underscores (_).\n\nExample: \`presidential-election-2024\``,
                flags: 64 // Ephemeral flag
            });
            return;
        }
        
        // Load existing elections
        const elections = loadElections();
        
        // Check if election already exists
        if (elections[electionName]) {
            await interaction.reply({
                content: `❌ **Election Already Exists**\n\nAn election named \`${electionName}\` already exists.\n\nChoose a different name or delete the existing election first.`,
                flags: 64 // Ephemeral flag
            });
            return;
        }
        
        // Parse start time
        let startTime;
        if (startInput) {
            startTime = new Date(startInput);
            if (isNaN(startTime.getTime())) {
                await interaction.reply({
                    content: `❌ **Invalid Start Time**\n\nPlease use format: YYYY-MM-DD HH:MM\nExample: \`2024-12-25 14:30\``,
                    flags: 64 // Ephemeral flag
                });
                return;
            }
        } else {
            startTime = new Date(); // Start now if not specified
        }

        // Parse duration and calculate end time
        const durationMs = parseDuration(durationInput);
        if (!durationMs) {
            await interaction.reply({
                content: `❌ **Invalid Duration**\n\nSupported formats:\n• \`24h\` (hours)\n• \`7d\` (days)\n• \`2w\` (weeks)\n• \`1m\` (months)\n\nExample: \`72h\` for 3 days`,
                flags: 64 // Ephemeral flag
            });
            return;
        }

        const endTime = new Date(startTime.getTime() + durationMs);

        // Create new election
        elections[electionName] = {
            name: electionName,
            createdBy: userId,
            createdAt: new Date().toISOString(),
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration: durationInput,
            status: getElectionStatus(startTime, endTime)
        };
        
        // Save elections
        if (saveElections(elections)) {
            const now = Date.now();
            const startTimestamp = Math.floor(startTime.getTime() / 1000);
            const endTimestamp = Math.floor(endTime.getTime() / 1000);
            const createdTimestamp = Math.floor(now / 1000);

            await interaction.reply({
                content: `✅ **Election Created Successfully!**\n\n📊 **Election:** \`${electionName}\`\n👤 **Created by:** ${username}\n🕒 **Created:** <t:${createdTimestamp}:f>\n⏰ **Starts:** <t:${startTimestamp}:f> (<t:${startTimestamp}:R>)\n⏰ **Ends:** <t:${endTimestamp}:f> (<t:${endTimestamp}:R>)\n📏 **Duration:** ${durationInput}\n📈 **Status:** ${elections[electionName].status}\n\n🎯 **Timeline:**\n• 🔑 **RSA keys:** Can be submitted anytime\n• 🗳️ **Voting & Candidates:** Only during active period\n• 📢 **Campaigns:** Only during active period\n\nAll commands require the election name parameter!`
            });
            console.log(`✅ Election '${electionName}' created successfully by admin ${username}`);
        } else {
            await interaction.reply({
                content: `❌ **Failed to Create Election**\n\nThere was an error saving the election data. Please try again.`,
                flags: 64 // Ephemeral flag
            });
            console.error(`❌ Failed to save election '${electionName}' created by ${username}`);
        }
    },
};