import { ChatInputCommandInteraction, SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { getPublicGist, microcoinsToCoins } from '../storage/github';

export const plotBondCurveCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('plotbondcurve')
    .setDescription('Generate and display the current bond price curve')
    .addStringOption(option =>
      option
        .setName('party')
        .setDescription('Party name to plot bond curve for')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.' });
      return;
    }

    const partyName = interaction.options.get('party')?.value as string;

    try {
      await interaction.deferReply();

      const election = await getPublicGist(interaction.guild.id);
      if (!election) {
        await interaction.editReply({ content: '❌ No active election found.' });
        return;
      }

      const party = election.parties[partyName];
      if (!party) {
        await interaction.editReply({ content: '❌ Party not found.' });
        return;
      }

      if (party.issuedTokens === 0) {
        await interaction.editReply({ content: '❌ No bonds created for this party.' });
        return;
      }

      // Generate curve data points
      const currentRemainingTokens = party.issuedTokens - party.soldTokens;
      const currentPool = party.pool;
      const currentPrice = microcoinsToCoins(currentPool / currentRemainingTokens);

      // Generate data points for the curve (what would happen if we bought tokens)
      const dataPoints: Array<{ tokens: number, price: number }> = [];
      
      for (let tokensSold = 0; tokensSold <= currentRemainingTokens - 1; tokensSold += Math.max(1, Math.floor(currentRemainingTokens / 50))) {
        const remainingTokens = currentRemainingTokens - tokensSold;
        const price = microcoinsToCoins(currentPool / remainingTokens);
        dataPoints.push({ tokens: party.issuedTokens - remainingTokens, price });
      }

      // Generate ASCII art plot
      const plotText = generateASCIIPlot(dataPoints, party.issuedTokens, currentPrice);

      await interaction.editReply({
        content: `📈 **Bond Curve for ${party.emoji} ${partyName}**\n\n` +
                 `**Current Status:**\n` +
                 `• Pool: ${microcoinsToCoins(currentPool).toFixed(6)} coins\n` +
                 `• Tokens Sold: ${party.soldTokens.toLocaleString()}\n` +
                 `• Tokens Available: ${currentRemainingTokens.toLocaleString()}\n` +
                 `• Current Price: ${currentPrice.toFixed(6)} coins/token\n\n` +
                 `**Bond Curve (Price vs Tokens Sold):**\n\`\`\`\n${plotText}\n\`\`\``
      });

    } catch (error) {
      console.error('Error plotting bond curve:', error);
      await interaction.editReply({ content: '❌ Failed to generate bond curve plot.' });
    }
  },
};

function generateASCIIPlot(data: Array<{ tokens: number, price: number }>, maxTokens: number, currentPrice: number): string {
  const width = 60;
  const height = 20;
  
  if (data.length === 0) return 'No data to plot';
  
  const maxPrice = Math.max(...data.map(d => d.price));
  const minPrice = Math.min(...data.map(d => d.price));
  const priceRange = maxPrice - minPrice || 1;
  
  // Create grid
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));
  
  // Plot data points
  for (const point of data) {
    const x = Math.floor((point.tokens / maxTokens) * (width - 1));
    const y = height - 1 - Math.floor(((point.price - minPrice) / priceRange) * (height - 1));
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y][x] = '*';
    }
  }
  
  // Add axes
  for (let i = 0; i < height; i++) {
    grid[i][0] = '|';
  }
  for (let i = 0; i < width; i++) {
    grid[height - 1][i] = '-';
  }
  grid[height - 1][0] = '+';
  
  // Convert to string
  let result = grid.map(row => row.join('')).join('\n');
  
  // Add labels
  result += `\n0 tokens${' '.repeat(width - 20)}${maxTokens.toLocaleString()} tokens\n`;
  result += `Price: ${minPrice.toFixed(4)} -> ${maxPrice.toFixed(4)} coins/token\n`;
  result += `Current: ${currentPrice.toFixed(6)} coins/token`;
  
  return result;
}
