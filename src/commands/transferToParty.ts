import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { getCombinedData } from '../utils/dataHelpers';
import { updatePublicGistAtomic, updateCommonGistAtomic, coinsToMicrocoins, microcoinsToCoins } from '../storage/github';
import { isPartyMember } from '../utils/permissions';

export const transferToPartyCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('transfertoparty')
    .setDescription('Transfer your personal funds to your party vault')
    .addStringOption(option =>
      option
        .setName('election')
        .setDescription('Election name or ID')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('party')
        .setDescription('Party name to transfer funds to')
        .setRequired(true)
    )
    .addNumberOption(option =>
      option
        .setName('amount')
        .setDescription('Amount of coins to transfer to party vault')
        .setRequired(true)
        .setMinValue(0.000001)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.user) {
      await interaction.reply({ content: 'This command can only be used in a server.' });
      return;
    }

    const electionName = interaction.options.getString('election', true);
    const partyName = interaction.options.getString('party', true);
    const transferAmount = interaction.options.getNumber('amount', true);

    try {
      await interaction.deferReply();

      // Get combined data
      const combinedData = await getCombinedData(interaction.guild.id);
      if (!combinedData) {
        await interaction.editReply({ content: '❌ No election data found for this server.' });
        return;
      }

      const { election, commonData } = combinedData;
      
      // Check if party exists
      if (!election.parties[partyName]) {
        await interaction.editReply({ content: `❌ Party "${partyName}" does not exist in this election.` });
        return;
      }

      // Check if user is a member of the party
      if (!(await isPartyMember(interaction, partyName, election))) {
        await interaction.editReply({ 
          content: `❌ You must be a member of "${partyName}" to transfer funds to its vault.` 
        });
        return;
      }

      const userId = interaction.user.id;
      
      // Calculate user's current balance (starts with 100 coins + any earned/spent)
      const currentBalanceMicrocoins = 100 * 1000000 + (commonData.balances[userId] || 0);
      const currentBalance = microcoinsToCoins(currentBalanceMicrocoins);
      const transferMicrocoins = coinsToMicrocoins(transferAmount);

      // Check if user has enough balance
      if (currentBalanceMicrocoins < transferMicrocoins) {
        await interaction.editReply({ 
          content: `❌ Insufficient funds! You have ${currentBalance.toFixed(6)} coins but tried to transfer ${transferAmount.toFixed(6)} coins.` 
        });
        return;
      }

      // Check for reasonable transfer amounts (prevent dust)
      if (transferMicrocoins < 1000) { // 0.001 coins minimum
        await interaction.editReply({ 
          content: '❌ Minimum transfer amount is 0.001 coins.' 
        });
        return;
      }

      console.log(`💰 User ${interaction.user.tag} transferring ${transferAmount.toFixed(6)} coins to ${partyName} vault`);

      // Perform the transfer atomically
      await Promise.all([
        // Update user balance (subtract transfer amount)
        updateCommonGistAtomic(interaction.guild.id, (data) => {
          data.balances[userId] = (data.balances[userId] || 0) - transferMicrocoins;
          data.meta.lastUpdated = new Date().toISOString();
          return data;
        }),
        
        // Update party vault (add transfer amount)
        updatePublicGistAtomic(interaction.guild.id, (data) => {
          if (data.parties[partyName]) {
            data.parties[partyName].vault += transferMicrocoins;
            data.meta.lastUpdated = new Date().toISOString();
          }
          return data;
        })
      ]);

      const newBalance = microcoinsToCoins(currentBalanceMicrocoins - transferMicrocoins);
      const newVault = microcoinsToCoins(election.parties[partyName].vault + transferMicrocoins);

      await interaction.editReply({
        content: `✅ **Transfer Successful!**\n\n` +
                 `**Transferred:** ${transferAmount.toFixed(6)} coins\n` +
                 `**From:** Your personal balance\n` +
                 `**To:** ${partyName} ${election.parties[partyName].emoji} party vault\n\n` +
                 `**Your New Balance:** ${newBalance.toFixed(6)} coins\n` +
                 `**Party Vault Balance:** ${newVault.toFixed(6)} coins\n\n` +
                 `💡 *These funds can now be used by party members for campaigning and bond purchases.*`
      });

    } catch (error) {
      console.error('Error transferring funds to party:', error);
      await interaction.editReply({ content: '❌ Failed to transfer funds. Please try again.' });
    }
  },
};
