const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const USERS_FILE = path.join(__dirname, '..', 'users.json');

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
            // Update existing user
            users[existingUserIndex] = userObject;
            console.log(`🔄 Updated public key for user: ${username} (${userId})`);
        } else {
            // Add new user
            users.push(userObject);
            console.log(`➕ Added new user: ${username} (${userId})`);
        }
        
        // Save to file
        const saveSuccess = saveUsers(users);
        
        if (saveSuccess) {
            await interaction.reply({
                content: `✅ **Public key stored successfully!**\n\`\`\`\nUser: ${username}\nKey: ${publicKey.substring(0, 20)}...\nStatus: ${existingUserIndex !== -1 ? 'Updated' : 'Added'}\n\`\`\``
            });
        } else {
            await interaction.reply({
                content: '❌ **Error storing public key.** Please try again later.'
            });
        }
    },
};