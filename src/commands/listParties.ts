import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { microcoinsToCoins } from '../storage/github';
import { getCombinedData } from '../utils/dataHelpers';

export const listPartiesCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('listparties')
    .setDescription('List all political parties and their information'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      await interaction.deferReply();

      // Get combined data
      const combinedData = await getCombinedData(interaction.guild.id);
      if (!combinedData) {
        await interaction.editReply({ content: '❌ No active election or common data found.' });
        return;
      }

      const parties = combinedData.election.parties;
      if (Object.keys(parties).length === 0) {
        await interaction.editReply({ content: '📋 No parties have been created yet.' });
        return;
      }

      let response = '## 🏛️ **Political Parties**\n\n';

      for (const [partyName, party] of Object.entries(parties)) {
        const memberCount = party.members.length;

        // Party header
        response += `### ${party.emoji} **${party.name}**\n`;
        response += `**Leader:** <@${party.leaderId}>\n`;
        response += `**Members:** ${memberCount}\n`;
        response += `**Agenda:** ${party.agenda}\n`;

        // Financial info
        response += `**Vault:** ${microcoinsToCoins(party.vault).toFixed(2)} coins\n`;
        response += `**Pool:** ${microcoinsToCoins(party.pool).toFixed(2)} coins\n`;
        
        if (party.issuedTokens > 0) {
          const tokenPrice = party.k / (party.issuedTokens - party.soldTokens);
          response += `**Token Price:** ${microcoinsToCoins(tokenPrice).toFixed(6)} coins\n`;
          response += `**Tokens Sold:** ${party.soldTokens.toLocaleString()} / ${party.issuedTokens.toLocaleString()}\n`;
        }

        response += '\n';
      }

      // Truncate if too long for Discord
      if (response.length > 2000) {
        response = response.substring(0, 1950) + '...\n\n*Response truncated*';
      }

      await interaction.editReply({ content: response });

    } catch (error) {
      console.error('Error listing parties:', error);
      await interaction.editReply({ 
        content: `❌ Failed to list parties: ${(error as Error).message}` 
      });
    }
  },
};
