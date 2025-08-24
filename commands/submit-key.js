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
    const git = simpleGit();
    
    if (!fs.existsSync(REPO_PATH)) {
        try {
            await git.clone('https://github.com/theSoberSobber/Public-Keys.git', REPO_PATH);
            console.log('📁 Cloned repository successfully');
        } catch (error) {
            console.error('❌ Error cloning repository:', error);
            return null;
        }
    }
    
    const repoGit = simpleGit(REPO_PATH);
    
    // Configure git with GitHub token
    const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (token) {
        await repoGit.addConfig('user.name', 'Discord Bot');
        await repoGit.addConfig('user.email', 'bot@example.com');
        console.log('🔧 Configured git credentials');
    }
    
    return repoGit;
}

// Commit public key to GitHub repository
async function commitToGitHub(userId, username, publicKey) {
    try {
        const git = await initializeGitRepo();
        if (!git) return false;
        
        // Pull latest changes first
        await git.pull('origin', 'main');
        
        // Create user directory and file
        const userDir = path.join(REPO_PATH, 'users', userId);
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        
        const keyFile = path.join(userDir, 'public_key.pem');
        fs.writeFileSync(keyFile, publicKey);
        
        // Create user info file
        const infoFile = path.join(userDir, 'info.json');
        const userInfo = {
            userId: userId,
            username: username,
            submittedAt: new Date().toISOString()
        };
        fs.writeFileSync(infoFile, JSON.stringify(userInfo, null, 2));
        
        // Add, commit and push
        await git.add('.');
        await git.commit(`Add/Update public key for user ${username} (${userId})`);
        
        const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
        const remoteUrl = `https://${token}@github.com/theSoberSobber/Public-Keys.git`;
        await git.push(remoteUrl, 'main');
        
        console.log(`✅ Successfully committed public key for ${username} to GitHub`);
        return true;
    } catch (error) {
        console.error('❌ Error committing to GitHub:', error);
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
        const gitSuccess = await commitToGitHub(userId, username, publicKey);
        
        if (saveSuccess && gitSuccess) {
            await interaction.editReply({
                content: `✅ **RSA public key stored and committed successfully!**\n\`\`\`\nUser: ${username}\nKey: ${publicKey.substring(0, 30)}...\nStatus: ${existingUserIndex !== -1 ? 'Updated' : 'Added'}\nGitHub: ✅ Committed\n\`\`\``
            });
        } else if (saveSuccess) {
            await interaction.editReply({
                content: `⚠️ **RSA public key stored locally but failed to commit to GitHub.**\n\`\`\`\nUser: ${username}\nKey: ${publicKey.substring(0, 30)}...\nStatus: ${existingUserIndex !== -1 ? 'Updated' : 'Added'}\nGitHub: ❌ Failed\n\`\`\``
            });
        } else {
            await interaction.editReply({
                content: '❌ **Error storing RSA public key.** Please try again later.'
            });
        }
    },
};