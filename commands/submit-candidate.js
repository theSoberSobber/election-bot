const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
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

// Initialize git repository with fresh clone strategy
async function initializeGitRepo() {
    try {
        console.log('🔄 Initializing Git repository for candidate...');
        const git = simpleGit();
        
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
            return null;
        }
        
        const repoGit = simpleGit(REPO_PATH);
        
        if (token) {
            try {
                await repoGit.addConfig('user.name', 'Discord Bot');
                await repoGit.addConfig('user.email', 'bot@example.com');
                console.log('✅ Git credentials configured successfully');
            } catch (configError) {
                console.error('❌ Error configuring git credentials:', configError.message);
            }
        }
        
        return repoGit;
    } catch (error) {
        console.error('❌ Fatal error in initializeGitRepo:', error.message);
        return null;
    }
}

// Commit candidate info to GitHub repository
async function commitCandidateToGitHub(userId, username, name, emoji, agenda, electionName) {
    console.log(`🚀 Starting candidate commit process for user: ${username} (${userId})`);
    
    try {
        const git = await initializeGitRepo();
        if (!git) {
            console.error('❌ Failed to initialize Git repository');
            return false;
        }
        
        // No need to pull - we have fresh clone with latest changes
        console.log('✅ Repository is fresh and up-to-date')
        
        // Create election-specific candidates directory and file
        const electionDir = path.join(REPO_PATH, 'elections', electionName);
        if (!fs.existsSync(electionDir)) {
            fs.mkdirSync(electionDir, { recursive: true });
            console.log('✅ Created election directory:', electionDir);
        }
        
        const candidatesDir = path.join(electionDir, 'candidates');
        if (!fs.existsSync(candidatesDir)) {
            fs.mkdirSync(candidatesDir, { recursive: true });
            console.log('✅ Created candidates directory');
        }
        
        const candidateFile = path.join(candidatesDir, `${userId}.json`);
        const candidateInfo = {
            userId: userId,
            username: username,
            name: name,
            emoji: emoji,
            agenda: agenda,
            submittedAt: new Date().toISOString()
        };
        
        fs.writeFileSync(candidateFile, JSON.stringify(candidateInfo, null, 2));
        console.log('✅ Written candidate file:', candidateFile);
        
        // Update election candidates list file
        const candidatesListFile = path.join(electionDir, 'candidates.json');
        let allCandidates = [];
        
        if (fs.existsSync(candidatesListFile)) {
            try {
                allCandidates = JSON.parse(fs.readFileSync(candidatesListFile, 'utf8'));
            } catch (e) {
                allCandidates = [];
            }
        }
        
        // Remove existing entry for this user if any, then add new one
        allCandidates = allCandidates.filter(c => c.userId !== userId);
        allCandidates.push(candidateInfo);
        
        fs.writeFileSync(candidatesListFile, JSON.stringify(allCandidates, null, 2));
        console.log('✅ Updated candidates list file');
        
        // Commit and push
        await git.add('.');
        await git.commit(`Add/Update candidate ${name} (${username} - ${userId}) in election ${electionName}`);
        
        const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
        const remoteUrl = `https://${token}@github.com/theSoberSobber/Public-Keys.git`;
        await git.push(remoteUrl, 'main');
        
        console.log(`🎉 Successfully committed candidate ${name} to GitHub repository!`);
        return true;
        
    } catch (error) {
        console.error('❌ Error committing candidate to GitHub:', error.message);
        console.error('   Full error:', error);
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
                ephemeral: true
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
                    ephemeral: true
                });
                return;
            }
            
            if (now > endTime) {
                const endTimestamp = Math.floor(endTime.getTime() / 1000);
                await interaction.reply({
                    content: `❌ **Election Has Ended!**\n\nThe election \`${electionName}\` has already ended.\n\n⏰ **Ended:** <t:${endTimestamp}:f> (<t:${endTimestamp}:R>)\n\nCandidate registration is no longer allowed.`,
                    ephemeral: true
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
            gitSuccess = await commitCandidateToGitHub(userId, username, name, emoji, agenda, electionName);
        } catch (gitError) {
            console.error('❌ GitHub commit failed with exception:', gitError.message);
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