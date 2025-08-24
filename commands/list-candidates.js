const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list-candidates')
        .setDescription('View all submitted candidates for an election')
        .addStringOption(option =>
            option.setName('election')
                .setDescription('Name of the election')
                .setRequired(true)),
    
    async execute(interaction) {
        const electionName = interaction.options.getString('election');
        console.log(`📋 Candidates list requested by user: ${interaction.user.username} for election: ${electionName}`);
        
        // Check if election exists
        const elections = loadElections();
        if (!elections[electionName]) {
            await interaction.reply({
                content: `❌ **Election not found!**\n\nThe election \`${electionName}\` does not exist.\n\nUse \`/list-elections\` to see available elections.`,
                ephemeral: true
            });
            return;
        }
        
        const candidates = loadCandidates(electionName);
        
        if (candidates.length === 0) {
            await interaction.reply({
                content: `📭 **No candidates have been submitted yet for \`${electionName}\`.**\n\nUse \`/submit-candidate\` to be the first candidate!`
            });
            return;
        }
        
        // Sort candidates by submission time (newest first)
        candidates.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        
        // Create embed for better formatting
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`🗳️ Election Candidates - ${electionName}`)
            .setDescription(`**${candidates.length} candidate${candidates.length > 1 ? 's' : ''} registered**`)
            .setTimestamp()
            .setFooter({ text: 'Use /submit-candidate to register your candidacy' });
        
        // Add each candidate as a field
        candidates.forEach((candidate, index) => {
            const fieldName = `${candidate.emoji} ${candidate.name}`;
            const fieldValue = `**Username:** ${candidate.username}\n**Agenda:** ${candidate.agenda.length > 200 ? candidate.agenda.substring(0, 200) + '...' : candidate.agenda}\n**Submitted:** ${new Date(candidate.submittedAt).toLocaleDateString()}`;
            
            embed.addFields({
                name: fieldName,
                value: fieldValue,
                inline: false
            });
        });
        
        // If too many candidates, split into multiple messages
        if (candidates.length > 10) {
            // Simple text format for many candidates
            let candidatesList = `🗳️ **Election Candidates for \`${electionName}\` (${candidates.length} total)**\n\n`;
            
            candidates.forEach((candidate, index) => {
                candidatesList += `**${index + 1}.** ${candidate.emoji} **${candidate.name}** (@${candidate.username})\n`;
                candidatesList += `   📋 ${candidate.agenda.length > 150 ? candidate.agenda.substring(0, 150) + '...' : candidate.agenda}\n`;
                candidatesList += `   📅 Submitted: ${new Date(candidate.submittedAt).toLocaleDateString()}\n\n`;
            });
            
            candidatesList += `\n🔍 **Use \`/submit-candidate\` to register your candidacy!**`;
            
            await interaction.reply({
                content: candidatesList.length > 2000 ? candidatesList.substring(0, 1900) + '\n\n...(too many candidates to display all)' : candidatesList
            });
        } else {
            await interaction.reply({ embeds: [embed] });
        }
        
        console.log(`✅ Displayed ${candidates.length} candidates to ${interaction.user.username}`);
    },
};