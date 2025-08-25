import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { hasAdminRole } from '../utils/permissions';
import { deleteElectionGists } from '../storage/github';

export const deleteElectionCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Delete the current election (admin only)'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.' });
      return;
    }

    if (!(await hasAdminRole(interaction))) {
      await interaction.reply({ content: 'You need the `electionBotAdmin` role to use this command.' });
      return;
    }

    try {
      await interaction.deferReply();

      await deleteElectionGists(interaction.guild.id);

      await interaction.editReply({
        content: `✅ Election deleted successfully!\n\nAll election data and gists have been removed.`,
      });

    } catch (error) {
      console.error('Error deleting election:', error);
      await interaction.editReply({ 
        content: `❌ Failed to delete election: ${(error as Error).message}` 
      });
    }
  },
};
