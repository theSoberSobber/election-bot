const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { submitCandidate } = require('../utils/github');

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

// Load candidates from election-specific JSON file
function loadCandidates(electionName) {
    const candidatesFile = path.join(__dirname, '..', `candidates-${electionName}.json`);
    try {
        if (!fs.existsSync(candidatesFile)) {
            return [];
        }
        const data = fs.readFileSync(candidatesFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading candidates file:', error);
        return [];
    }
}

// Save candidates to election-specific JSON file
function saveCandidates(candidates, electionName) {
    const candidatesFile = path.join(__dirname, '..', `candidates-${electionName}.json`);
    try {
        fs.writeFileSync(candidatesFile, JSON.stringify(candidates, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving candidates file:', error);
        return false;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('submit-candidate')
        .setDescription('Submit your candidacy information for an election')
        .addStringOption(option =>
            option.setName('election')
                .setDescription('Name of the election')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Your candidate name')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('emoji')
                .setDescription('Your candidate emoji (single emoji)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('agenda')
                .setDescription('Your campaign agenda/platform')
                .setRequired(true)),
    
    async execute(interaction) {
        const electionName = interaction.options.getString('election');
        const name = interaction.options.getString('name');
        const emoji = interaction.options.getString('emoji');
        const agenda = interaction.options.getString('agenda');
        const userId = interaction.user.id;
        const username = interaction.user.username;
        
        console.log(`👤 Candidate submission attempt by user: ${username} for election: ${electionName}`);
        
        // Check if election exists and is active
        const elections = loadElections();
        if (!elections[electionName]) {
            await interaction.reply({
                content: `❌ **Election not found!**\n\nThe election \`${electionName}\` does not exist.\n\nUse \`/list-elections\` to see available elections.`,
                flags: 64 // Ephemeral flag
            });
            return;
        }
        
        // Check if election is active (if timing is configured)
        const election = elections[electionName];
        if (election.startTime && election.endTime) {
            const now = new Date();
            const startTime = new Date(election.startTime);
            const endTime = new Date(election.endTime);
            
            if (now < startTime) {
                const startTimestamp = Math.floor(startTime.getTime() / 1000);
                await interaction.reply({
                    content: `❌ **Election Not Started Yet!**\n\nThe election \`${electionName}\` hasn't started yet.\n\n⏰ **Starts:** <t:${startTimestamp}:f> (<t:${startTimestamp}:R>)\n\nYou can submit your RSA key now, but candidate registration opens when the election starts.`,
                    flags: 64 // Ephemeral flag
                });
                return;
            }
            
            if (now > endTime) {
                const endTimestamp = Math.floor(endTime.getTime() / 1000);
                await interaction.reply({
                    content: `❌ **Election Has Ended!**\n\nThe election \`${electionName}\` has already ended.\n\n⏰ **Ended:** <t:${endTimestamp}:f> (<t:${endTimestamp}:R>)\n\nCandidate registration is no longer allowed.`,
                    flags: 64 // Ephemeral flag
                });
                return;
            }
        }
        
        // Check if user has submitted their public key for this election
        const users = loadUsers(electionName);
        const userHasKey = users.find(user => user.userId === userId);
        
        if (!userHasKey) {
            await interaction.reply({
                content: `❌ **You must submit your public key first!**\n\nUse the \`/submit-key\` command to register your RSA public key before you can submit your candidacy.\n\nThis ensures your identity can be verified.`
            });
            console.log(`❌ User ${username} attempted to submit candidacy without public key`);
            return;
        }
        
        // Validate emoji (should be single emoji)
        if (emoji.length > 10) {
            await interaction.reply({
                content: '❌ **Invalid emoji!** Please provide a single emoji character for your candidacy.'
            });
            return;
        }
        
        await interaction.deferReply();
        
                // TRANSACTIONAL APPROACH: Commit to GitHub FIRST
        console.log(`🔄 Starting transactional candidate submission for user: ${username}`);
        let gitSuccess = false;
        
        try {
            gitSuccess = await submitCandidate(userId, username, name, emoji, agenda, electionName);
        } catch (gitError) {
            console.error('❌ GitHub commit failed with exception:', gitError.message);
            console.error('   Full error:', gitError);
            gitSuccess = false;
        }
        
        if (gitSuccess) {
            // Only save locally if GitHub commit succeeded
            console.log(`✅ GitHub commit successful, now recording locally for ${username}`);
            
            let candidates = loadCandidates(electionName);
            
            // Remove existing candidacy if any (latest is source of truth)
            candidates = candidates.filter(c => c.userId !== userId);
            
            const candidateObject = {
                userId: userId,
                username: username,
                name: name,
                emoji: emoji,
                agenda: agenda,
                submittedAt: new Date().toISOString()
            };
            
            candidates.push(candidateObject);
            const saveSuccess = saveCandidates(candidates, electionName);
            
            if (saveSuccess) {
                await interaction.editReply({
                    content: `✅ **Candidacy submitted successfully!**\n\n👤 **Candidate Information:**\n\`\`\`\nName: ${name}\nEmoji: ${emoji}\nAgenda: ${agenda.substring(0, 100)}${agenda.length > 100 ? '...' : ''}\nSubmitted: ${new Date().toLocaleString()}\n\`\`\`\n\n🔍 Use \`/list-candidates\` to see all candidates!`
                });
                console.log(`✅ Transaction completed successfully for candidate ${name} (${username}): GitHub ✅ Local ✅`);
            } else {
                await interaction.editReply({
                    content: `⚠️ **Unusual situation:** Candidacy committed to GitHub but local save failed.\n\nYour candidacy is publicly available, but there may be a local tracking issue.\n\n**Candidate:** ${name}\n**Status:** GitHub ✅, Local ❌`
                });
                console.log(`⚠️  Unusual state for candidate ${name} (${username}): GitHub ✅ Local ❌`);
            }
        } else {
            // GitHub commit failed, don't record anything locally
            await interaction.editReply({
                content: `❌ **Candidacy submission failed!**\n\nUnable to commit your candidacy to GitHub. Your candidacy has NOT been recorded.\n\n**You can try submitting again** once the issue is resolved.\n\n**Status:** Nothing recorded (transaction rolled back)`
            });
            console.log(`❌ Transaction failed for candidate ${name} (${username}): GitHub ❌ - No local recording`);
        }
    },
};