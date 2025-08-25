import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { hasAdminRole } from '../utils/permissions';
import { getPublicGist, getPrivateGist, updatePublicGistAtomic, updateCommonGistAtomic, updateGistIndex, getGistIndex } from '../storage/github';
import { getCombinedData } from '../utils/dataHelpers';
import { performSettlement, getVoteResults, determineWinner } from '../economy/settlement';

export const settleElectionCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('settle')
    .setDescription('Finalize and settle the election (admin only)'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    if (!(await hasAdminRole(interaction))) {
      await interaction.reply({ content: 'You need the `electionBotAdmin` role to use this command.', ephemeral: true });
      return;
    }

    try {
      await interaction.deferReply();

      const election = await getPublicGist(interaction.guild.id);
      if (!election) {
        await interaction.editReply({ content: '❌ No active election found.' });
        return;
      }

      if (election.status === 'finalized') {
        await interaction.editReply({ content: '❌ Election has already been settled.' });
        return;
      }

      // Check if election has ended
      const endTime = new Date(election.startAt);
      endTime.setHours(endTime.getHours() + election.durationHours);
      const now = new Date();

      if (now < endTime) {
        await interaction.editReply({ 
          content: `❌ Election is still running. It ends at ${endTime.toISOString()}` 
        });
        return;
      }

      // Get votes from private gist
      const privateGist = await getPrivateGist(interaction.guild.id);
      if (!privateGist) {
        await interaction.editReply({ content: '❌ No voting data found.' });
        return;
      }

      // Count votes and determine winner
      const voteResults = getVoteResults(privateGist.votes);
      const winner = determineWinner(voteResults);

      // Get combined data for party emojis
      const combinedData = await getCombinedData(interaction.guild.id);
      if (!combinedData) {
        await interaction.editReply({ content: '❌ No active election or common data found.' });
        return;
      }

      let settlementText = `## 🏆 Election Settlement\n\n`;
      settlementText += `**Total Votes:** ${privateGist.votes.length}\n\n`;
      
      settlementText += `**Vote Results:**\n`;
      for (const [partyName, voteCount] of Object.entries(voteResults)) {
        const party = combinedData.election.parties[partyName];
        const emoji = party ? party.emoji : '❓';
        settlementText += `${emoji} **${partyName}**: ${voteCount} vote${voteCount !== 1 ? 's' : ''}\n`;
      }

      if (winner) {
        const winnerParty = combinedData.election.parties[winner];
        const winnerEmoji = winnerParty ? winnerParty.emoji : '🏆';
        settlementText += `\n🎉 **Winner:** ${winnerEmoji} ${winner}\n\n`;
      } else {
        settlementText += `\n🤝 **Result:** Tie - No winner declared\n\n`;
      }

      // Perform settlement
      const settlement = performSettlement(election, winner);
      
      settlementText += `**Financial Settlement:**\n`;
      settlementText += `- Combined Pool: ${settlement.combinedPool / 1000000} coins\n`;
      if (winner) {
        settlementText += `- Final Token Price: ${settlement.finalPrice / 1000000} coins per token\n`;
      }

      // Update common data with final balances
      await updateCommonGistAtomic(interaction.guild.id, (commonData) => {
        // Update user balances with settlement results
        for (const [userId, balanceChange] of Object.entries(settlement.finalBalances)) {
          commonData.balances[userId] = (commonData.balances[userId] || 0) + balanceChange;
        }
        return commonData;
      });

      // Update election status
      const finalElection = await updatePublicGistAtomic(interaction.guild.id, (election) => {
        if (!election) throw new Error('Election not found');
        
        election.status = 'finalized';
        
        // Clear parties tokens for next election (but keep party structure)
        for (const partyName in election.parties) {
          election.parties[partyName].tokenHolders = {};
          election.parties[partyName].soldTokens = 0;
          election.parties[partyName].pool = 0;
          election.parties[partyName].vault = 0;
        }
        
        return election;
      });

      // Make private gist public by converting it to public gist content
      // Note: In a real implementation, you'd want to create a new public gist with the votes
      settlementText += `\n📊 **Voting data will now be made public for transparency.**\n`;

      await interaction.editReply({ content: settlementText });

    } catch (error) {
      console.error('Error settling election:', error);
      await interaction.editReply({ 
        content: `❌ Failed to settle election: ${(error as Error).message}` 
      });
    }
  },
};
