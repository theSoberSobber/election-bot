const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const NodeRSA = require('node-rsa');
const simpleGit = require('simple-git');

const USERS_FILE = path.join(__dirname, '..', 'users.json');
const REPO_PATH = path.join(__dirname, '..', 'public-keys-repo');

// Initialize users file if it doesn't exist
function initializeUsersFile() {
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
    }
}

// Load users from JSON file
function loadUsers() {
    initializeUsersFile();
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading users file:', error);
        return [];
    }
}

// Save users to JSON file
function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving users file:', error);
        return false;
    }
}

// Validate RSA public key
function validateRSAKey(publicKeyString) {
    try {
        const key = new NodeRSA();
        key.importKey(publicKeyString, 'public');
        return key.getKeySize() > 0; // Check if key is valid
    } catch (error) {
        return false;
    }
}

// Initialize and setup git repository
async function initializeGitRepo() {
    try {
        console.log('🔄 Initializing Git repository...');
        const git = simpleGit();
        
        // Check GitHub token availability
        const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
        console.log('🔑 GitHub token available:', token ? 'YES' : 'NO');
        
        if (!fs.existsSync(REPO_PATH)) {
            console.log('📁 Repository not found locally, cloning...');
            try {
                await git.clone('https://github.com/theSoberSobber/Public-Keys.git', REPO_PATH);
                console.log('✅ Repository cloned successfully to:', REPO_PATH);
            } catch (cloneError) {
                console.error('❌ Error cloning repository:', cloneError.message);
                console.error('   Full error:', cloneError);
                return null;
            }
        } else {
            console.log('📁 Repository already exists at:', REPO_PATH);
        }
        
        const repoGit = simpleGit(REPO_PATH);
        
        // Configure git credentials
        if (token) {
            try {
                await repoGit.addConfig('user.name', 'Discord Bot');
                await repoGit.addConfig('user.email', 'bot@example.com');
                console.log('✅ Git credentials configured successfully');
            } catch (configError) {
                console.error('❌ Error configuring git credentials:', configError.message);
                console.error('   Full error:', configError);
            }
        } else {
            console.error('❌ No GitHub token available for authentication');
        }
        
        console.log('✅ Git repository initialization complete');
        return repoGit;
        
    } catch (error) {
        console.error('❌ Fatal error in initializeGitRepo:', error.message);
        console.error('   Full error:', error);
        return null;
    }
}

// Commit public key to GitHub repository
async function commitToGitHub(userId, username, publicKey) {
    console.log(`🚀 Starting GitHub commit process for user: ${username} (${userId})`);
    
    try {
        // Step 1: Initialize Git repository
        console.log('📝 Step 1: Initializing Git repository...');
        const git = await initializeGitRepo();
        if (!git) {
            console.error('❌ Failed to initialize Git repository');
            return false;
        }
        console.log('✅ Step 1 completed: Git repository ready');
        
        // Step 2: Pull latest changes
        console.log('📝 Step 2: Pulling latest changes...');
        try {
            await git.pull('origin', 'main');
            console.log('✅ Step 2 completed: Successfully pulled latest changes');
        } catch (pullError) {
            console.error('⚠️  Step 2 warning: Pull failed (might be first commit):', pullError.message);
            // Continue anyway - might be first commit
        }
        
        // Step 3: Create user directory and files
        console.log('📝 Step 3: Creating user files...');
        const userDir = path.join(REPO_PATH, 'users', userId);
        console.log('   User directory path:', userDir);
        
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
            console.log('   ✅ Created user directory');
        } else {
            console.log('   ✅ User directory already exists');
        }
        
        // Write public key file
        const keyFile = path.join(userDir, 'public_key.pem');
        fs.writeFileSync(keyFile, publicKey);
        console.log('   ✅ Written public key file:', keyFile);
        
        // Write user info file
        const infoFile = path.join(userDir, 'info.json');
        const userInfo = {
            userId: userId,
            username: username,
            submittedAt: new Date().toISOString()
        };
        fs.writeFileSync(infoFile, JSON.stringify(userInfo, null, 2));
        console.log('   ✅ Written user info file:', infoFile);
        console.log('✅ Step 3 completed: User files created');
        
        // Step 4: Add files to git
        console.log('📝 Step 4: Adding files to git...');
        await git.add('.');
        console.log('✅ Step 4 completed: Files added to git staging');
        
        // Step 5: Commit changes
        console.log('📝 Step 5: Committing changes...');
        const commitMessage = `Add/Update public key for user ${username} (${userId})`;
        await git.commit(commitMessage);
        console.log('✅ Step 5 completed: Changes committed with message:', commitMessage);
        
        // Step 6: Push to GitHub
        console.log('📝 Step 6: Pushing to GitHub...');
        const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
        if (!token) {
            console.error('❌ No GitHub token available for push');
            return false;
        }
        
        const remoteUrl = `https://${token}@github.com/theSoberSobber/Public-Keys.git`;
        console.log('   Remote URL configured (token hidden for security)');
        
        await git.push(remoteUrl, 'main');
        console.log('✅ Step 6 completed: Successfully pushed to GitHub');
        
        console.log(`🎉 Successfully committed public key for ${username} to GitHub repository!`);
        return true;
        
    } catch (error) {
        console.error('❌ Fatal error in commitToGitHub process:');
        console.error('   Error message:', error.message);
        console.error('   Error code:', error.code || 'N/A');
        console.error('   Error stack:', error.stack);
        
        // Additional error context
        if (error.message.includes('Authentication')) {
            console.error('🔑 Authentication issue - check GitHub token');
        } else if (error.message.includes('Permission')) {
            console.error('🔐 Permission issue - check repository access');
        } else if (error.message.includes('Network')) {
            console.error('🌐 Network issue - check internet connection');
        }
        
        return false;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('submit-key')
        .setDescription('Submit your public key for storage')
        .addStringOption(option =>
            option.setName('publickey')
                .setDescription('Your public key')
                .setRequired(true)),
    
    async execute(interaction) {
        const publicKey = interaction.options.getString('publickey');
        const userId = interaction.user.id;
        const username = interaction.user.username;
        
        // Validate that the key is a valid RSA public key
        if (!validateRSAKey(publicKey)) {
            await interaction.reply({
                content: '❌ **Invalid RSA public key!** Please provide a valid RSA public key in PEM format.'
            });
            return;
        }
        
        // Defer reply for longer operations
        await interaction.deferReply();
        
        // Load existing users
        let users = loadUsers();
        
        // Check if user already exists
        const existingUserIndex = users.findIndex(user => user.userId === userId);
        
        const userObject = {
            userId: userId,
            username: username,
            publicKey: publicKey,
            submittedAt: new Date().toISOString()
        };
        
        if (existingUserIndex !== -1) {
            // Update existing user (latest is source of truth)
            users[existingUserIndex] = userObject;
            console.log(`🔄 Updated public key for user: ${username} (${userId})`);
        } else {
            // Add new user
            users.push(userObject);
            console.log(`➕ Added new user: ${username} (${userId})`);
        }
        
        // Save to file
        const saveSuccess = saveUsers(users);
        
        // Commit to GitHub repository
        console.log(`📤 Attempting GitHub commit for user: ${username}`);
        let gitSuccess = false;
        
        try {
            gitSuccess = await commitToGitHub(userId, username, publicKey);
        } catch (gitError) {
            console.error('❌ GitHub commit failed with exception:', gitError.message);
            console.error('   Full error:', gitError);
            gitSuccess = false;
        }
        
        // Prepare response based on success/failure
        if (saveSuccess && gitSuccess) {
            console.log(`✅ Complete success for user ${username}: Local ✅ GitHub ✅`);
            await interaction.editReply({
                content: `✅ **RSA public key stored and committed successfully!**\n\`\`\`\nUser: ${username}\nKey: ${publicKey.substring(0, 30)}...\nStatus: ${existingUserIndex !== -1 ? 'Updated' : 'Added'}\nGitHub: ✅ Committed\n\`\`\``
            });
        } else if (saveSuccess) {
            console.log(`⚠️  Partial success for user ${username}: Local ✅ GitHub ❌`);
            await interaction.editReply({
                content: `⚠️ **RSA public key stored locally but failed to commit to GitHub.**\n\`\`\`\nUser: ${username}\nKey: ${publicKey.substring(0, 30)}...\nStatus: ${existingUserIndex !== -1 ? 'Updated' : 'Added'}\nGitHub: ❌ Failed (check logs)\n\`\`\``
            });
        } else {
            console.log(`❌ Complete failure for user ${username}: Local ❌ GitHub ❌`);
            await interaction.editReply({
                content: '❌ **Error storing RSA public key.** Please try again later.'
            });
        }
    },
};