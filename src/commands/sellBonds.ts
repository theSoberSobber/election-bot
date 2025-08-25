import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { getPublicGist, updatePublicGistAtomic, getCommonGist, updateCommonGistAtomic, coinsToMicrocoins, microcoinsToCoins } from '../storage/github';
import { calculateBondSale, applyBondSale } from '../economy/bonds';

export const sellBondsCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('sellbonds')
    .setDescription('Sell your party bonds back to the market')
    .addStringOption(option =>
      option
        .setName('party')
        .setDescription('Party name')
        .setRequired(true)
    )
    .addNumberOption(option =>
      option
        .setName('tokens')
        .setDescription('Number of tokens to sell')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.user) {
      await interaction.reply({ content: 'This command can only be used in a server.' });
      return;
    }

    const partyName = interaction.options.getString('party', true);
    const tokens = interaction.options.getNumber('tokens', true);

    if (tokens <= 0) {
      await interaction.reply({ content: 'Token amount must be positive.' });
      return;
    }

    if (!Number.isInteger(tokens)) {
      await interaction.reply({ content: 'Token amount must be a whole number.' });
      return;
    }

    try {
      await interaction.deferReply();

      let coinsRefunded = 0;

      const updated = await updatePublicGistAtomic(interaction.guild.id, (election) => {
        if (!election) {
          throw new Error('No active election found');
        }

        if (election.status !== 'running' && election.status !== 'scheduled') {
          throw new Error('Election is not active');
        }

        const party = election.parties[partyName];
        if (!party) {
          throw new Error('Party not found');
        }

        if (party.issuedTokens === 0) {
          throw new Error('Party has not issued bonds yet');
        }

        const userId = interaction.user!.id;
        const userTokens = party.tokenHolders[userId] || 0;

        if (userTokens < tokens) {
          throw new Error(`You only have ${userTokens} tokens, cannot sell ${tokens}`);
        }

        // Calculate bond sale
        const saleResult = calculateBondSale(party, tokens);

        // Reserve the refund temporarily
        const refundMicrocoins = saleResult.coinsRefunded;
        coinsRefunded = refundMicrocoins; // Store for later use
        election.reserved[userId] = (election.reserved[userId] || 0) + refundMicrocoins;

        // Apply the sale
        election.parties[partyName] = applyBondSale(party, userId, tokens, saleResult);

        // Clear reservation
        election.reserved[userId] = Math.max(0, (election.reserved[userId] || 0) - refundMicrocoins);

        return election;
      });

      // Update common data (add coins back to seller)
      await updateCommonGistAtomic(interaction.guild.id, (commonData) => {
        commonData.balances[interaction.user.id] = (commonData.balances[interaction.user.id] || 0) + coinsRefunded;
        return commonData;
      });

      const updatedParty = updated.parties[partyName];
      const newPrice = updatedParty.k / (updatedParty.issuedTokens - updatedParty.soldTokens);
      const userTokensRemaining = updatedParty.tokenHolders[interaction.user.id] || 0;

      await interaction.editReply({
        content: `✅ Successfully sold bonds!\n\n` +
                 `**Party:** ${partyName}\n` +
                 `**Tokens Sold:** ${tokens.toLocaleString()}\n` +
                 `**Coins Received:** ${microcoinsToCoins(coinsRefunded).toFixed(6)}\n` +
                 `**New Token Price:** ${microcoinsToCoins(newPrice).toFixed(6)} coins\n` +
                 `**Your Remaining Tokens:** ${userTokensRemaining.toLocaleString()}`,
      });

    } catch (error) {
      console.error('Error selling bonds:', error);
      await interaction.editReply({ 
        content: `❌ Failed to sell bonds: ${(error as Error).message}` 
      });
    }
  },
};
