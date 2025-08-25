import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { updatePublicGistAtomic } from '../storage/github';
import { getCombinedData } from '../utils/dataHelpers';

export const leavePartyCommand = {
  data: new SlashCommandBuilder()
    .setName('leaveparty')
    .setDescription('Leave a political party')
    .addStringOption(option =>
      option.setName('party')
        .setDescription('Name of the party to leave')
        .setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const partyName = interaction.options.getString('party', true);

    try {
      // Get election data
      const combinedData = await getCombinedData(guildId);
      if (!combinedData) {
        await interaction.reply({ content: '❌ No election data found for this server.' });
        return;
      }

      const { election } = combinedData;
      
      // Check if party exists in election
      if (!election.parties[partyName]) {
        await interaction.reply({ content: `❌ Party "${partyName}" does not exist in this election.` });
        return;
      }

      const party = election.parties[partyName];
      
      // Check if user is a member
      if (!party.members.includes(userId)) {
        await interaction.reply({ content: `❌ You are not a member of "${partyName}".` });
        return;
      }

      // Check if user is the party leader
      if (party.leaderId === userId) {
        await interaction.reply({ content: '❌ Party leaders cannot leave their party. Use `/deleteparty` to delete the party instead.' });
        return;
      }

      // Update election data
      await updatePublicGistAtomic(guildId, (election) => {
        election.parties[partyName].members = election.parties[partyName].members.filter((memberId: string) => memberId !== userId);
        return election;
      });

      await interaction.reply({
        content: `✅ You have left the party "${partyName}" successfully!`
      });

    } catch (error) {
      console.error('Error in leaveParty command:', error);
      await interaction.reply({ content: '❌ An error occurred while leaving the party.' });
    }
  }
};
