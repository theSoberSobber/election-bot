import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { hasAdminRole } from '../utils/permissions';
import { updatePublicGistAtomic } from '../storage/github';
import { getCombinedData } from '../utils/dataHelpers';

export const deletePartyCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('deleteparty')
    .setDescription('Delete a political party')
    .addStringOption(option =>
      option
        .setName('party')
        .setDescription('Party name to delete')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.user) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const partyName = interaction.options.getString('party', true);

    try {
      await interaction.deferReply({ ephemeral: true });

      // Get combined data
      const combinedData = await getCombinedData(interaction.guild.id);
      if (!combinedData) {
        await interaction.editReply({ content: '❌ No active election found.' });
        return;
      }

      const party = combinedData.election.parties[partyName];

      if (!party) {
        await interaction.editReply({ content: '❌ Party not found in this election.' });
        return;
      }

      // Check permissions: party leader or admin
      const isLeader = party.leaderId === interaction.user.id;
      const isAdmin = await hasAdminRole(interaction);

      if (!isLeader && !isAdmin) {
        await interaction.editReply({ content: '❌ Only party leaders or admins can delete parties.' });
        return;
      }

      // Handle fund redistribution if party has vault balance
      let redistributionNote = '';
      if (party.vault > 0) {
        const vaultCoins = party.vault / 1000000;
        redistributionNote = `\n\n⚠️ Party had ${vaultCoins.toFixed(2)} coins in vault - these have been burned.`;
      }

      // Delete from election data
      await updatePublicGistAtomic(interaction.guild.id, (election) => {
        delete election.parties[partyName];
        return election;
      });

      await interaction.editReply({
        content: `✅ Party "${partyName}" has been deleted successfully!${redistributionNote}`,
      });

    } catch (error) {
      console.error('Error deleting party:', error);
      await interaction.editReply({ 
        content: `❌ Failed to delete party: ${(error as Error).message}` 
      });
    }
  },
};
