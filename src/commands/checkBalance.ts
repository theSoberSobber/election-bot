import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { getCommonGist, microcoinsToCoins } from '../storage/github';

export const checkBalanceCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your current coin balance'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.user) {
      await interaction.reply({ content: 'This command can only be used in a server.' });
      return;
    }

    try {
      await interaction.deferReply();

      // Get common data to check balance
      const commonData = await getCommonGist(interaction.guild.id);
      if (!commonData) {
        await interaction.editReply({ content: '❌ No data found for this server.' });
        return;
      }

      const userId = interaction.user.id;
      
      // Calculate current balance (everyone starts with 100 coins)
      const baseBalanceMicrocoins = 100 * 1000000;
      const adjustmentsMicrocoins = commonData.balances[userId] || 0;
      const totalBalanceMicrocoins = baseBalanceMicrocoins + adjustmentsMicrocoins;
      
      const totalBalance = microcoinsToCoins(totalBalanceMicrocoins);
      const baseBalance = microcoinsToCoins(baseBalanceMicrocoins);
      const adjustments = microcoinsToCoins(adjustmentsMicrocoins);

      const balanceEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('💰 Your Balance')
        .setDescription(`<@${userId}>'s current balance`)
        .addFields(
          {
            name: '🪙 Total Balance',
            value: `${totalBalance.toFixed(6)} coins`,
            inline: true
          },
          {
            name: '🎯 Base Amount',
            value: `${baseBalance.toFixed(6)} coins`,
            inline: true
          },
          {
            name: '📊 Adjustments',
            value: `${adjustments.toFixed(6)} coins`,
            inline: true
          }
        )
        .setFooter({ 
          text: 'Use /transfertoparty to fund your party vault!' 
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [balanceEmbed] });

    } catch (error) {
      console.error('Error checking balance:', error);
      await interaction.editReply({ content: '❌ Failed to check balance. Please try again.' });
    }
  },
};
