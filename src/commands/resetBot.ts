import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { hasAdminRole } from '../utils/permissions';
import { getGistIndex, updateGistIndex } from '../storage/github';

export const resetBotCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('resetbot')
    .setDescription('Reset bot state for this server (admin only)'),

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

      const index = await getGistIndex();
      const guildId = interaction.guild.id;
      
      if (!index.entries[guildId]) {
        await interaction.editReply({ content: '❌ No bot state found for this server.' });
        return;
      }

      // Remove entry from gist index (does not delete gists)
      delete index.entries[guildId];
      await updateGistIndex(index);

      await interaction.editReply({
        content: `✅ Bot state reset for this server.\n\nThe gist index entry has been removed. Existing gists were preserved.`,
      });

    } catch (error) {
      console.error('Error resetting bot:', error);
      await interaction.editReply({ 
        content: `❌ Failed to reset bot: ${(error as Error).message}` 
      });
    }
  },
};
