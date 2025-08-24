const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const NodeRSA = require('node-rsa');
const simpleGit = require('simple-git');

const ELECTIONS_FILE = path.join(__dirname, '..', 'elections.json');
const REPO_PATH = path.join(__dirname, '..', 'public-keys-repo');

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

// Load users from election-specific JSON file
function loadUsers(electionName) {
    const usersFile = path.join(__dirname, '..', `users-${electionName}.json`);
    try {
        if (!fs.existsSync(usersFile)) {
            return [];
        }
        const data = fs.readFileSync(usersFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading users file:', error);
        return [];
    }
}

// Save users to election-specific JSON file
function saveUsers(users, electionName) {
    const usersFile = path.join(__dirname, '..', `users-${electionName}.json`);
    try {
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
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

// Initialize and setup git repository with fresh clone strategy
async function initializeGitRepo() {
    try {
        console.log('🔄 Initializing Git repository...');
        const git = simpleGit();
        
        // Check GitHub token availability
        const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
        console.log('🔑 GitHub token available:', token ? 'YES' : 'NO');
        
        // Always use fresh clone to avoid sync issues
        console.log('🗑️  Removing existing repository to ensure clean state...');
        if (fs.existsSync(REPO_PATH)) {
            fs.rmSync(REPO_PATH, { recursive: true, force: true });
            console.log('✅ Old repository removed');
        }
        
        console.log('📁 Cloning fresh repository...');
        try {
            const cloneUrl = `https://${token}@github.com/theSoberSobber/Public-Keys.git`;
            await git.clone(cloneUrl, REPO_PATH);
            console.log('✅ Fresh repository cloned successfully to:', REPO_PATH);
        } catch (cloneError) {
            console.error('❌ Error cloning repository:', cloneError.message);
            console.error('   Full error:', cloneError);
            return null;
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
async function commitToGitHub(userId, username, publicKey, electionName) {
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
        
        // Step 2: Repository is fresh and up-to-date 
        console.log('📝 Step 2: Repository is fresh with latest changes');
        console.log('✅ Step 2 completed: No sync needed for fresh clone')
        
        // Step 3: Create election-specific user directory and files
        console.log('📝 Step 3: Creating election-specific user files...');
        const electionDir = path.join(REPO_PATH, 'elections', electionName);
        if (!fs.existsSync(electionDir)) {
            fs.mkdirSync(electionDir, { recursive: true });
            console.log('   ✅ Created election directory:', electionDir);
        }
        
        const userDir = path.join(electionDir, 'users', userId);
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
        const commitMessage = `Add/Update public key for user ${username} (${userId}) in election ${electionName}`;
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
        .setDescription('Submit your public key for storage in an election')
        .addStringOption(option =>
            option.setName('election')
                .setDescription('Name of the election')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('publickey')
                .setDescription('Your public key')
                .setRequired(true)),
    
    async execute(interaction) {
        const electionName = interaction.options.getString('election');
        const publicKey = interaction.options.getString('publickey');
        const userId = interaction.user.id;
        const username = interaction.user.username;
        
        console.log(`🔑 Key submission attempt by user: ${username} for election: ${electionName}`);
        
        // Check if election exists
        const elections = loadElections();
        if (!elections[electionName]) {
            await interaction.reply({
                content: `❌ **Election not found!**\n\nThe election \`${electionName}\` does not exist.\n\nUse \`/list-elections\` to see available elections.`,
                flags: 64 // Ephemeral flag
            });
            return;
        }
        
        // Validate that the key is a valid RSA public key
        if (!validateRSAKey(publicKey)) {
            await interaction.reply({
                content: '❌ **Invalid RSA public key!** Please provide a valid RSA public key in PEM format.'
            });
            return;
        }
        
        // Defer reply for longer operations
        await interaction.deferReply();
        
        // Load existing users for this election
        let users = loadUsers(electionName);
        
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
        
        // TRANSACTIONAL APPROACH: Commit to GitHub FIRST
        console.log(`🔄 Starting transactional key submission for user: ${username}`);
        let gitSuccess = false;
        
        try {
            gitSuccess = await commitToGitHub(userId, username, publicKey, electionName);
        } catch (gitError) {
            console.error('❌ GitHub commit failed with exception:', gitError.message);
            console.error('   Full error:', gitError);
            gitSuccess = false;
        }
        
        if (gitSuccess) {
            // Only save locally if GitHub commit succeeded
            console.log(`✅ GitHub commit successful, now recording locally for ${username}`);
            
            if (existingUserIndex !== -1) {
                // Update existing user (latest is source of truth)
                users[existingUserIndex] = userObject;
                console.log(`🔄 Updated public key for user: ${username} (${userId})`);
            } else {
                // Add new user
                users.push(userObject);
                console.log(`➕ Added new user: ${username} (${userId})`);
            }
            
            const saveSuccess = saveUsers(users, electionName);
            
            if (saveSuccess) {
                await interaction.editReply({
                    content: `✅ **RSA public key stored and committed successfully!**\n\`\`\`\nUser: ${username}\nElection: ${electionName}\nKey: ${publicKey.substring(0, 30)}...\nStatus: ${existingUserIndex !== -1 ? 'Updated' : 'Added'}\nGitHub: ✅ Committed\n\`\`\``
                });
                console.log(`✅ Transaction completed successfully for user ${username}: GitHub ✅ Local ✅`);
            } else {
                await interaction.editReply({
                    content: `⚠️ **Unusual situation:** Key committed to GitHub but local save failed.\n\nYour key is publicly available, but there may be a local tracking issue.\n\n**User:** ${username}\n**Status:** GitHub ✅, Local ❌`
                });
                console.log(`⚠️  Unusual state for user ${username}: GitHub ✅ Local ❌`);
            }
        } else {
            // GitHub commit failed, don't record anything locally
            await interaction.editReply({
                content: `❌ **Key submission failed!**\n\nUnable to commit your public key to GitHub. Your key has NOT been recorded.\n\n**You can try submitting again** once the issue is resolved.\n\n**Status:** Nothing recorded (transaction rolled back)`
            });
            console.log(`❌ Transaction failed for user ${username}: GitHub ❌ - No local recording`);
        }
    },
};