import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { getGistIndex } from '../storage/github';

export const listElectionsCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('listelections')
    .setDescription('List all elections for this server'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      await interaction.deferReply();

      const index = await getGistIndex();
      const guildEntry = index.entries[interaction.guild.id];

      if (!guildEntry) {
        await interaction.editReply({ content: '📋 No elections found for this server.' });
        return;
      }

      let response = `## 🗳️ Elections for This Server\n\n`;
      response += `**Election ID:** ${guildEntry.electionId}\n`;
      response += `**Created:** ${new Date(guildEntry.createdAt).toLocaleString()}\n`;
      response += `**Public Gist:** https://gist.github.com/${guildEntry.publicGistId}\n`;
      response += `**Private Gist:** ${guildEntry.privateGistId} (votes - secret until settlement)\n`;

      await interaction.editReply({ content: response });

    } catch (error) {
      console.error('Error listing elections:', error);
      await interaction.editReply({ content: '❌ Failed to list elections.' });
    }
  },
};
