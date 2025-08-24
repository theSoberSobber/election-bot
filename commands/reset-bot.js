const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const simpleGit = require('simple-git');

const ELECTIONS_FILE = path.join(__dirname, '..', 'elections.json');
const CANDIDATES_FILE = path.join(__dirname, '..', 'candidates.json');
const VOTES_FILE = path.join(__dirname, '..', 'votes.json');
const REPO_PATH = path.join(__dirname, '..', 'public-keys-repo');

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
                ephemeral: true
            });
            console.log(`❌ User ${username} attempted to reset bot without admin role`);
            return;
        }
        
        // Check confirmation
        if (confirmation !== 'RESET-EVERYTHING') {
            await interaction.reply({
                content: `❌ **Confirmation Required**\n\nTo confirm this destructive action, you must type exactly:\n\`RESET-EVERYTHING\`\n\n⚠️  **This will permanently delete:**\n• All elections\n• All candidates\n• All votes\n• All RSA keys\n• All GitHub repository data\n\n**This action cannot be undone!**`,
                ephemeral: true
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
            
            // 2. Clear local repository
            if (fs.existsSync(REPO_PATH)) {
                console.log('🗑️  Removing local repository...');
                fs.rmSync(REPO_PATH, { recursive: true, force: true });
                resetResults.push('✅ Deleted local repository copy');
            }
            
            // 3. Clear GitHub repositories
            console.log('🗑️  Clearing GitHub repositories...');
            const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
            
            if (token) {
                try {
                    // Clone fresh to get all current data
                    const git = simpleGit();
                    const cloneUrl = `https://${token}@github.com/theSoberSobber/Public-Keys.git`;
                    await git.clone(cloneUrl, REPO_PATH);
                    
                    const repoGit = simpleGit(REPO_PATH);
                    await repoGit.addConfig('user.name', 'Discord Bot');
                    await repoGit.addConfig('user.email', 'bot@example.com');
                    
                    // Remove all contents except .git
                    const items = fs.readdirSync(REPO_PATH);
                    for (const item of items) {
                        if (item !== '.git') {
                            const itemPath = path.join(REPO_PATH, item);
                            if (fs.lstatSync(itemPath).isDirectory()) {
                                fs.rmSync(itemPath, { recursive: true, force: true });
                            } else {
                                fs.unlinkSync(itemPath);
                            }
                        }
                    }
                    
                    // Create empty README
                    fs.writeFileSync(path.join(REPO_PATH, 'README.md'), '# Public Keys Repository\n\nBot was reset - all data cleared.\n');
                    
                    // Commit the reset
                    await repoGit.add('.');
                    await repoGit.commit('🔥 Bot reset - all data cleared');
                    await repoGit.push('origin', 'main');
                    
                    resetResults.push('✅ Cleared GitHub repository completely');
                    
                    // Final cleanup
                    fs.rmSync(REPO_PATH, { recursive: true, force: true });
                    
                } catch (gitError) {
                    console.error('❌ GitHub reset error:', gitError.message);
                    resetResults.push(`❌ GitHub reset failed: ${gitError.message}`);
                }
            } else {
                resetResults.push('⚠️  No GitHub token - could not clear remote repository');
            }
            
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