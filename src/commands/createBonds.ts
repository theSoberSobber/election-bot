import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { getPublicGist, updatePublicGistAtomic, getCommonGist, updateCommonGistAtomic, coinsToMicrocoins, microcoinsToCoins } from '../storage/github';
import { getCombinedData } from '../utils/dataHelpers';
import { isPartyLeader } from '../utils/permissions';
import { validatePositiveInteger, validateRange } from '../utils/numbers';

export const createBondsCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('createbonds')
    .setDescription('Create election bonds for your party')
    .addStringOption(option =>
      option
        .setName('party')
        .setDescription('Party name')
        .setRequired(true)
    )
    .addNumberOption(option =>
      option
        .setName('amount')
        .setDescription('Initial coin amount to commit to pool')
        .setRequired(true)
    )
    .addNumberOption(option =>
      option
        .setName('tokens')
        .setDescription('Total number of tokens to issue')
        .setRequired(true)
    )
    .addNumberOption(option =>
      option
        .setName('alpha')
        .setDescription('Pool allocation ratio (0.0-1.0, how much of buys goes to pool vs vault)')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.user) {
      await interaction.reply({ content: 'This command can only be used in a server.' });
      return;
    }

    const partyName = interaction.options.get('party')?.value as string;
    const amount = interaction.options.get('amount')?.value as number;
    const tokens = interaction.options.get('tokens')?.value as number;
    const alpha = interaction.options.get('alpha')?.value as number;

    if (!partyName || !amount || !tokens || alpha === undefined) {
      await interaction.reply({ content: 'All fields are required.' });
      return;
    }

    try {
      validatePositiveInteger(amount, 'Amount');
      validatePositiveInteger(tokens, 'Tokens');
      validateRange(alpha, 0, 1, 'Alpha');
    } catch (error) {
      await interaction.reply({ content: (error as Error).message });
      return;
    }

    try {
      await interaction.deferReply();

      const amountMicrocoins = coinsToMicrocoins(amount);
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

      if (party.issuedTokens > 0) {
        await interaction.editReply({ content: '❌ Bonds already created for this party.' });
        return;
      }

      // Check if user is the party leader
      if (!party || party.leaderId !== userId) {
        await interaction.editReply({ content: '❌ Only the party leader can create bonds.' });
        return;
      }

      // Get common data for balance checking
      const combinedData = await getCombinedData(interaction.guild.id);
      if (!combinedData) {
        await interaction.editReply({ content: '❌ Common data not found.' });
        return;
      }

      // Check if leader has enough available coins
      const currentBalance = 100 * 1000000 + (combinedData.commonData.balances[userId] || 0);
      const reserved = election.reserved[userId] || 0;
      const available = currentBalance - reserved;

      if (available < amountMicrocoins) {
        await interaction.editReply({ 
          content: `❌ Insufficient funds. Available: ${(available / 1000000).toFixed(6)} coins, Required: ${amount} coins` 
        });
        return;
      }

      // Update common data (deduct coins from leader)
      await updateCommonGistAtomic(interaction.guild.id, (commonData) => {
        commonData.balances[userId] = (commonData.balances[userId] || 0) - amountMicrocoins;
        return commonData;
      });

      // Update election data (create bonds)
      await updatePublicGistAtomic(interaction.guild.id, (election) => {
        // Reserve the funds temporarily
        election.reserved[userId] = (election.reserved[userId] || 0) + amountMicrocoins;

        // Update party with bond parameters
        const party = election.parties[partyName];
        party.pool = amountMicrocoins;
        party.vault = 0;
        party.issuedTokens = tokens;
        party.soldTokens = 0;
        party.alpha = alpha;
        party.k = amountMicrocoins * tokens; // P * N

        // Clear reservation
        election.reserved[userId] = Math.max(0, (election.reserved[userId] || 0) - amountMicrocoins);

        return election;
      });

      // Get updated data for display
      const updatedElection = await getPublicGist(interaction.guild.id);
      const updatedParty = updatedElection!.parties[partyName];
      const initialPrice = updatedParty.k / updatedParty.issuedTokens;

      await interaction.editReply({
        content: `✅ Election bonds created for party "${partyName}"!\n\n` +
                 `**Initial Pool:** ${amount} coins\n` +
                 `**Tokens Issued:** ${tokens.toLocaleString()}\n` +
                 `**Alpha (Pool Ratio):** ${alpha}\n` +
                 `**Initial Price:** ${(initialPrice / 1000000).toFixed(6)} coins per token\n\n` +
                 `Supporters can now buy bonds with \`/buybonds ${partyName} <amount>\`.`,
      });

    } catch (error) {
      console.error('Error creating bonds:', error);
      await interaction.editReply({ 
        content: `❌ Failed to create bonds: ${(error as Error).message}` 
      });
    }
  },
};
