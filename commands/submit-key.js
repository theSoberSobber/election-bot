const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const NodeRSA = require('node-rsa');
const { submitPublicKey } = require('../utils/github');

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
            gitSuccess = await submitPublicKey(userId, username, publicKey, electionName);
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