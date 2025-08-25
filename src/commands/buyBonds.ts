import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { getPublicGist, updatePublicGistAtomic, getCommonGist, updateCommonGistAtomic, coinsToMicrocoins } from '../storage/github';
import { calculateBondPurchase, applyBondPurchase } from '../economy/bonds';

export const buyBondsCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('buybonds')
    .setDescription('Buy election bonds for a party')
    .addStringOption(option =>
      option
        .setName('party')
        .setDescription('Party name')
        .setRequired(true)
    )
    .addNumberOption(option =>
      option
        .setName('coins')
        .setDescription('Number of coins to spend')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.user) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const partyName = interaction.options.get('party')?.value as string;
    const coins = interaction.options.get('coins')?.value as number;

    if (!partyName || !coins) {
      await interaction.reply({ content: 'All fields are required.', ephemeral: true });
      return;
    }

    if (coins <= 0) {
      await interaction.reply({ content: 'Coin amount must be positive.', ephemeral: true });
      return;
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      const coinsMicrocoins = coinsToMicrocoins(coins);
      const userId = interaction.user.id;

      // Get current election and common data
      const election = await getPublicGist(interaction.guild.id);
      if (!election) {
        await interaction.editReply({ content: '❌ No active election found.' });
        return;
      }

      if (election.status !== 'running' && election.status !== 'scheduled') {
        await interaction.editReply({ content: '❌ Election is not active.' });
        return;
      }

      const party = election.parties[partyName];
      if (!party) {
        await interaction.editReply({ content: '❌ Party not found.' });
        return;
      }

      if (party.issuedTokens === 0) {
        await interaction.editReply({ content: '❌ Party has not issued bonds yet.' });
        return;
      }

      const commonData = await getCommonGist(interaction.guild.id);
      if (!commonData) {
        await interaction.editReply({ content: '❌ Common data not found. Please contact admin.' });
        return;
      }

      // Check available balance from common data
      const currentBalance = 100 * 1000000 + (commonData.balances[userId] || 0);
      const reserved = election.reserved[userId] || 0;
      const available = currentBalance - reserved;

      if (available < coinsMicrocoins) {
        await interaction.editReply({ 
          content: `❌ Insufficient funds. Available: ${(available / 1000000).toFixed(6)} coins, Required: ${coins} coins` 
        });
        return;
      }

      // Calculate bond purchase
      const purchaseResult = calculateBondPurchase(party, coinsMicrocoins);

      // Update common data (subtract coins)
      await updateCommonGistAtomic(interaction.guild.id, (commonData) => {
        commonData.balances[userId] = (commonData.balances[userId] || 0) - coinsMicrocoins;
        return commonData;
      });

      // Update election data (bonds and reservations)
      await updatePublicGistAtomic(interaction.guild.id, (election) => {
        // Reserve funds (temporarily)
        election.reserved[userId] = (election.reserved[userId] || 0) + coinsMicrocoins;

        // Apply the purchase
        election.parties[partyName] = applyBondPurchase(
          election.parties[partyName], 
          userId, 
          purchaseResult
        );

        // Clear reservation
        election.reserved[userId] = Math.max(0, (election.reserved[userId] || 0) - coinsMicrocoins);

        return election;
      });

      // Get updated election data to show results
      const updatedElection = await getPublicGist(interaction.guild.id);
      const updatedParty = updatedElection!.parties[partyName];
      const tokensAcquired = updatedParty.tokenHolders[interaction.user.id] || 0;

      await interaction.editReply({
        content: `✅ Successfully purchased bonds!\n\n` +
                 `**Party:** ${partyName}\n` +
                 `**Coins Spent:** ${coins}\n` +
                 `**Tokens Acquired:** ${purchaseResult.tokensAcquired.toLocaleString()}\n` +
                 `**New Token Price:** ${(purchaseResult.newPrice / 1000000).toFixed(6)} coins\n` +
                 `**Your Total Token Holdings:** ${tokensAcquired.toLocaleString()} tokens`,
      });

    } catch (error) {
      console.error('Error buying bonds:', error);
      await interaction.editReply({ 
        content: `❌ Failed to buy bonds: ${(error as Error).message}` 
      });
    }
  },
};

function calculateTokenPrice(party: any): number {
  const remainingTokens = party.issuedTokens - party.soldTokens;
  return party.k / remainingTokens;
}
