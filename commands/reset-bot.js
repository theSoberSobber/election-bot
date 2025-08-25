const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { clearAllRepositories } = require('../utils/github');

const ELECTIONS_FILE = path.join(__dirname, '..', 'elections.json');
const CANDIDATES_FILE = path.join(__dirname, '..', 'candidates.json');
const VOTES_FILE = path.join(__dirname, '..', 'votes.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset-bot')
        .setDescription('[ADMIN] DANGER: Completely reset bot and clear all GitHub repositories')
        .addStringOption(option =>
            option.setName('confirm')
                .setDescription('Type "RESET-EVERYTHING" to confirm this destructive action')
                .setRequired(true)),
    
    async execute(interaction) {
        const confirmation = interaction.options.getString('confirm');
        const userId = interaction.user.id;
        const username = interaction.user.username;
        
        console.log(`💥 Bot reset attempt by user: ${username} (${userId})`);
        
        // Check if user has electionBotAdmin role
        const member = interaction.member;
        const hasAdminRole = member.roles.cache.some(role => role.name === 'electionBotAdmin');
        
        if (!hasAdminRole) {
            await interaction.reply({
                content: `❌ **Access Denied**\n\nYou need the \`electionBotAdmin\` role to reset the bot.\n\nOnly authorized administrators can perform destructive operations.`,
                flags: 64 // Ephemeral flag
            });
            console.log(`❌ User ${username} attempted to reset bot without admin role`);
            return;
        }
        
        // Check confirmation
        if (confirmation !== 'RESET-EVERYTHING') {
            await interaction.reply({
                content: `❌ **Confirmation Required**\n\nTo confirm this destructive action, you must type exactly:\n\`RESET-EVERYTHING\`\n\n⚠️  **This will permanently delete:**\n• All elections\n• All candidates\n• All votes\n• All RSA keys\n• All GitHub repository data\n\n**This action cannot be undone!**`,
                flags: 64 // Ephemeral flag
            });
            return;
        }
        
        await interaction.deferReply();
        
        let resetResults = [];
        
        try {
            // 1. Clear all local files
            console.log('🗑️  Clearing local files...');
            const filesToDelete = [ELECTIONS_FILE, CANDIDATES_FILE, VOTES_FILE];
            for (const file of filesToDelete) {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                    resetResults.push(`✅ Deleted local file: ${path.basename(file)}`);
                }
            }
            
            // 2. Clear all local data files (elections, candidates, votes, user files)
            console.log('🗑️  Clearing all local data files...');
            
            // Clear election-specific files (users-*.json, candidates-*.json, votes-*.json)
            const dataDir = path.dirname(ELECTIONS_FILE);
            const allFiles = fs.readdirSync(dataDir);
            
            for (const file of allFiles) {
                if (file.match(/^(users|candidates|votes)-.*\.json$/)) {
                    const filePath = path.join(dataDir, file);
                    fs.unlinkSync(filePath);
                    resetResults.push(`✅ Deleted election data file: ${file}`);
                }
            }
            
            // 3. Clear GitHub repositories using API
            console.log('🗑️  Clearing GitHub repositories via API...');
            const githubResults = await clearAllRepositories();
            resetResults.push(...githubResults);
            
            // 4. Success message
            const resultMessage = `🔥 **BOT COMPLETELY RESET**\n\n**Reset performed by:** ${username}\n**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:f>\n\n**Actions taken:**\n${resetResults.join('\n')}\n\n✅ **The bot is now in fresh state.**\nAdmins can create new elections with \`/create-election\`.`;
            
            await interaction.editReply({
                content: resultMessage
            });
            
            console.log(`🔥 Bot completely reset by admin ${username}`);
            console.log('Reset results:', resetResults);
            
        } catch (error) {
            console.error('❌ Fatal error during bot reset:', error);
            await interaction.editReply({
                content: `❌ **Reset Failed**\n\nAn error occurred during the reset process:\n\`${error.message}\`\n\nSome data may have been partially cleared. Check logs for details.`
            });
        }
    },
};