import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { isPartyMember } from '../utils/permissions';
import { getPublicGist, updatePublicGistAtomic, getCommonGist, updateCommonGistAtomic, microcoinsToCoins } from '../storage/github';
import { getCombinedData } from '../utils/dataHelpers';

export const campaignCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('campaign')
    .setDescription('Create a campaign post for your party')
    .addStringOption(option =>
      option
        .setName('party')
        .setDescription('Party name')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('headline')
        .setDescription('Campaign headline')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('body')
        .setDescription('Campaign message body')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.user) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const partyName = interaction.options.get('party')?.value as string;
    const headline = interaction.options.get('headline')?.value as string;
    const body = interaction.options.get('body')?.value as string;

    if (!partyName || !headline || !body) {
      await interaction.reply({ content: 'All fields are required.', ephemeral: true });
      return;
    }

    if (headline.length > 100) {
      await interaction.reply({ content: 'Headline must be 100 characters or less.', ephemeral: true });
      return;
    }

    if (body.length > 1000) {
      await interaction.reply({ content: 'Campaign body must be 1000 characters or less.', ephemeral: true });
      return;
    }

    try {
      await interaction.deferReply();

      // Get combined data
      const combinedData = await getCombinedData(interaction.guild.id);
      if (!combinedData) {
        await interaction.editReply({ content: '❌ No active election found.' });
        return;
      }

      const party = combinedData.election.parties[partyName];

      if (!party) {
        await interaction.editReply({ content: `❌ Party "${partyName}" not found in this election.` });
        return;
      }

      // Check if user is a member of the party
      if (!party.members.includes(interaction.user.id)) {
        await interaction.editReply({ content: '❌ You must be a member of the party to campaign for it.' });
        return;
      }

      // Calculate campaign cost (1 coin per 100 chars, minimum 1 coin)
      const totalLength = headline.length + body.length;
      const cost = Math.max(1, Math.ceil(totalLength / 100));
      const costMicrocoins = cost * 1000000;

      // Check if party vault has enough funds
      if (party.vault < costMicrocoins) {
        await interaction.editReply({ 
          content: `❌ Insufficient party vault funds. Required: ${cost} coins, Available: ${microcoinsToCoins(party.vault).toFixed(2)} coins` 
        });
        return;
      }

      // Deduct cost from party vault
      await updatePublicGistAtomic(interaction.guild.id, (election) => {
        if (!election) throw new Error('Election not found');
        
        election.parties[partyName].vault -= costMicrocoins;
        return election;
      });

      // Post the campaign message
      const campaignEmbed = {
        color: 0x0099ff,
        title: `📢 Campaign for ${party.emoji} ${partyName}`,
        description: `**${headline}**\n\n${body}`,
        fields: [
          {
            name: 'Campaigner',
            value: `<@${interaction.user.id}>`,
            inline: true,
          },
          {
            name: 'Cost',
            value: `${cost} coins`,
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
      };

      await interaction.editReply({ embeds: [campaignEmbed] });

    } catch (error) {
      console.error('Error creating campaign:', error);
      await interaction.editReply({ 
        content: `❌ Failed to create campaign: ${(error as Error).message}` 
      });
    }
  },
};
