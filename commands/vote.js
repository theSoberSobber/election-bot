const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { submitVote } = require('../utils/github');

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

// Load votes from election-specific JSON file
function loadVotes(electionName) {
    const votesFile = path.join(__dirname, '..', `votes-${electionName}.json`);
    try {
        if (!fs.existsSync(votesFile)) {
            return [];
        }
        const data = fs.readFileSync(votesFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading votes file:', error);
        return [];
    }
}

// Save votes to election-specific JSON file
function saveVotes(votes, electionName) {
    const votesFile = path.join(__dirname, '..', `votes-${electionName}.json`);
    try {
        fs.writeFileSync(votesFile, JSON.stringify(votes, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving votes file:', error);
        return false;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Submit your signed vote message (one-time only)')
        .addStringOption(option =>
            option.setName('election')
                .setDescription('Name of the election')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('signed-message')
                .setDescription('Your message signed with your private key')
                .setRequired(true)),
    
    async execute(interaction) {
        const electionName = interaction.options.getString('election');
        const signedMessage = interaction.options.getString('signed-message');
        const userId = interaction.user.id;
        const username = interaction.user.username;
        
        console.log(`🗳️  Vote attempt by user: ${username} for election: ${electionName}`);
        
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
                    content: `❌ **Election Not Started Yet!**\n\nThe election \`${electionName}\` hasn't started yet.\n\n⏰ **Starts:** <t:${startTimestamp}:f> (<t:${startTimestamp}:R>)\n\nVoting will be available when the election starts.`,
                    flags: 64 // Ephemeral flag
                });
                return;
            }
            
            if (now > endTime) {
                const endTimestamp = Math.floor(endTime.getTime() / 1000);
                await interaction.reply({
                    content: `❌ **Election Has Ended!**\n\nThe election \`${electionName}\` has already ended.\n\n⏰ **Ended:** <t:${endTimestamp}:f> (<t:${endTimestamp}:R>)\n\nVoting is no longer allowed.`,
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
                content: `❌ **You must submit your public key first!**\n\nUse the \`/submit-key\` command to register your RSA public key before you can vote.\n\nThis ensures we can verify your signed messages.`
            });
            console.log(`❌ User ${username} attempted to vote without submitting public key`);
            return;
        }
        
        // Check if user has already voted in this election
        const votes = loadVotes(electionName);
        const existingVote = votes.find(vote => vote.userId === userId);
        
        if (existingVote) {
            await interaction.reply({
                content: `❌ **You have already submitted your vote!**\n\nVoting is limited to **one submission per user**. Your vote was recorded on: \`${new Date(existingVote.submittedAt).toLocaleString()}\`\n\nNo additional votes can be accepted.`
            });
            console.log(`❌ User ${username} attempted to vote again (already voted on ${existingVote.submittedAt})`);
            return;
        }
        
        // Create confirmation buttons
        const confirmRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('vote_confirm')
                    .setLabel('✅ Yes, Submit My Vote')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('vote_cancel')
                    .setLabel('❌ Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.reply({
            content: `🗳️  **IMPORTANT: Final Vote Confirmation**\n\n⚠️  **You can only vote ONCE!**\n\nOnce you confirm, your signed message will be permanently recorded and you will **NOT** be able to vote again.\n\n**Your signed message:**\n\`\`\`${signedMessage.substring(0, 200)}${signedMessage.length > 200 ? '...' : ''}\`\`\`\n\n**Are you sure you want to submit this as your final vote?**`,
            components: [confirmRow]
        });
        
        // Create button interaction collector
        const filter = (buttonInteraction) => {
            return buttonInteraction.user.id === userId && 
                   (buttonInteraction.customId === 'vote_confirm' || buttonInteraction.customId === 'vote_cancel');
        };
        
        const collector = interaction.channel.createMessageComponentCollector({
            filter,
            time: 60000 // 1 minute timeout
        });
        
        collector.on('collect', async (buttonInteraction) => {
            if (buttonInteraction.customId === 'vote_cancel') {
                await buttonInteraction.update({
                    content: '❌ **Vote cancelled.** You can use `/vote` again when you\'re ready to submit.',
                    components: []
                });
                console.log(`❌ User ${username} cancelled their vote submission`);
                return;
            }
            
            if (buttonInteraction.customId === 'vote_confirm') {
                await buttonInteraction.deferUpdate();
                
                // Double-check they haven't voted in the meantime
                const currentVotes = loadVotes(electionName);
                const doubleCheckVote = currentVotes.find(vote => vote.userId === userId);
                
                if (doubleCheckVote) {
                    await buttonInteraction.editReply({
                        content: '❌ **Vote submission failed!** You have already voted while this confirmation was pending.',
                        components: []
                    });
                    return;
                }
                
                // TRANSACTIONAL APPROACH: Commit to GitHub FIRST
                console.log(`🔄 Starting transactional vote process for ${username}`);
                let gitSuccess = false;
                
                try {
                    gitSuccess = await submitVote(userId, username, signedMessage, electionName);
                } catch (gitError) {
                    console.error('❌ Vote GitHub commit failed:', gitError.message);
                    gitSuccess = false;
                }
                
                if (gitSuccess) {
                    // Only record locally if GitHub commit succeeded
                    console.log(`✅ GitHub commit successful, now recording locally for ${username}`);
                    const voteObject = {
                        userId: userId,
                        username: username,
                        signedMessage: signedMessage,
                        submittedAt: new Date().toISOString()
                    };
                    
                    currentVotes.push(voteObject);
                    const saveSuccess = saveVotes(currentVotes, electionName);
                    
                    if (saveSuccess) {
                        await buttonInteraction.editReply({
                            content: `✅ **Vote submitted successfully!**\n\n🗳️  Your signed message has been recorded and committed to the blockchain of votes.\n\n**User:** ${username}\n**Submission Time:** ${new Date().toLocaleString()}\n**Status:** Permanently recorded\n\n⚠️  **Remember:** This was your one and only vote submission.`,
                            components: []
                        });
                        console.log(`✅ Transaction completed successfully for user ${username}: GitHub ✅ Local ✅`);
                    } else {
                        await buttonInteraction.editReply({
                            content: `⚠️  **Unusual situation:** Vote committed to GitHub but local save failed.\n\nYour vote is publicly recorded, but there may be a local tracking issue.\n\n**User:** ${username}\n**Status:** GitHub ✅, Local ❌`,
                            components: []
                        });
                        console.log(`⚠️  Unusual state for user ${username}: GitHub ✅ Local ❌`);
                    }
                } else {
                    // GitHub commit failed, don't record anything locally
                    await buttonInteraction.editReply({
                        content: `❌ **Vote submission failed!**\n\nUnable to commit your vote to GitHub. Your vote has NOT been recorded.\n\n**You can try voting again** once the issue is resolved.\n\n**Status:** Nothing recorded (transaction rolled back)`,
                        components: []
                    });
                    console.log(`❌ Transaction failed for user ${username}: GitHub ❌ - No local recording`);
                }
            }
        });
        
        collector.on('end', (collected) => {
            if (collected.size === 0) {
                interaction.editReply({
                    content: '⏰ **Vote confirmation timeout.** Use `/vote` again when you\'re ready to submit.',
                    components: []
                }).catch(console.error);
                console.log(`⏰ Vote confirmation timeout for user ${username}`);
            }
        });
    },
};