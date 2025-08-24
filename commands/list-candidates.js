const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const CANDIDATES_FILE = path.join(__dirname, '..', 'candidates.json');

// Load candidates from JSON file
function loadCandidates() {
    try {
        if (!fs.existsSync(CANDIDATES_FILE)) {
            return [];
        }
        const data = fs.readFileSync(CANDIDATES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading candidates file:', error);
        return [];
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list-candidates')
        .setDescription('View all submitted candidates'),
    
    async execute(interaction) {
        console.log(`📋 Candidates list requested by user: ${interaction.user.username}`);
        
        const candidates = loadCandidates();
        
        if (candidates.length === 0) {
            await interaction.reply({
                content: '📭 **No candidates have been submitted yet.**\n\nUse `/submit-candidate` to be the first candidate!'
            });
            return;
        }
        
        // Sort candidates by submission time (newest first)
        candidates.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        
        // Create embed for better formatting
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🗳️ Election Candidates')
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
            let candidatesList = `🗳️ **Election Candidates (${candidates.length} total)**\n\n`;
            
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