import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { getPublicGist, microcoinsToCoins } from '../storage/github';

export const plotPriceHistoryCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('plotpricehistory')
    .setDescription('Display bond price history over time')
    .addStringOption(option =>
      option
        .setName('party')
        .setDescription('Party name to plot price history for')
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

      if (!party.transactions || party.transactions.length === 0) {
        await interaction.editReply({ 
          content: `📊 **Price History for ${party.emoji} ${partyName}**\n\n` +
                   `No transaction history available yet. Bond prices will be tracked after the first buy/sell transactions.`
        });
        return;
      }

      // Calculate price at each transaction point
      const priceHistory: Array<{ time: Date, price: number, type: string, tokens: number }> = [];
      
      // Add initial state
      if (party.issuedTokens > 0) {
        const initialPrice = microcoinsToCoins(party.pool / party.issuedTokens);
        priceHistory.push({
          time: new Date(party.transactions[0]?.timestamp || Date.now()),
          price: initialPrice,
          type: 'initial',
          tokens: party.issuedTokens
        });
      }

      // Process each transaction to calculate price after the transaction
      let cumulativeSoldTokens = 0;
      let cumulativePool = party.pool;

      for (const tx of party.transactions) {
        if (tx.type === 'buy') {
          cumulativeSoldTokens += tx.tokens;
          cumulativePool += tx.coins;
        } else {
          cumulativeSoldTokens -= tx.tokens;
          cumulativePool -= tx.coins;
        }

        const remainingTokens = party.issuedTokens - cumulativeSoldTokens;
        const price = remainingTokens > 0 ? microcoinsToCoins(cumulativePool / remainingTokens) : 0;

        priceHistory.push({
          time: new Date(tx.timestamp),
          price,
          type: tx.type,
          tokens: remainingTokens
        });
      }

      // Generate ASCII time series plot
      const plotText = generateTimeSeriesPlot(priceHistory);

      // Format transaction summary
      const recentTransactions = party.transactions.slice(-10).reverse();
      const txSummary = recentTransactions.map(tx => {
        const time = new Date(tx.timestamp).toLocaleTimeString();
        const action = tx.type === 'buy' ? '🟢 BUY' : '🔴 SELL';
        return `${time} ${action} ${tx.tokens} tokens for ${microcoinsToCoins(tx.coins).toFixed(3)} coins`;
      }).join('\n');

      await interaction.editReply({
        content: `📊 **Price History for ${party.emoji} ${partyName}**\n\n` +
                 `**Current Price:** ${priceHistory[priceHistory.length - 1]?.price.toFixed(6) || 'N/A'} coins/token\n` +
                 `**Total Transactions:** ${party.transactions.length}\n\n` +
                 `**Price Over Time:**\n\`\`\`\n${plotText}\n\`\`\`\n\n` +
                 `**Recent Transactions:**\n\`\`\`\n${txSummary || 'No recent transactions'}\n\`\`\``
      });

    } catch (error) {
      console.error('Error plotting price history:', error);
      await interaction.editReply({ content: '❌ Failed to generate price history plot.' });
    }
  },
};

function generateTimeSeriesPlot(history: Array<{ time: Date; price: number; type: string }>): string {
  const width = 60;
  const height = 15;
  
  if (history.length === 0) return 'No price history available';
  
  const prices = history.map(h => h.price);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const priceRange = maxPrice - minPrice || 1;
  
  const startTime = history[0].time.getTime();
  const endTime = history[history.length - 1].time.getTime();
  const timeRange = endTime - startTime || 1;
  
  // Create grid
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));
  
  // Plot price points
  for (let i = 0; i < history.length; i++) {
    const h = history[i];
    const x = Math.floor(((h.time.getTime() - startTime) / timeRange) * (width - 1));
    const y = height - 1 - Math.floor(((h.price - minPrice) / priceRange) * (height - 1));
    
    if (x >= 0 && x < width && y >= 0 && y < height) {
      // Use different symbols for buy/sell
      const symbol = h.type === 'buy' ? '^' : h.type === 'sell' ? 'v' : '*';
      grid[y][x] = symbol;
    }
    
    // Connect with lines if possible
    if (i > 0) {
      const prevH = history[i - 1];
      const prevX = Math.floor(((prevH.time.getTime() - startTime) / timeRange) * (width - 1));
      const prevY = height - 1 - Math.floor(((prevH.price - minPrice) / priceRange) * (height - 1));
      
      // Simple line connection
      const steps = Math.abs(x - prevX) + Math.abs(y - prevY);
      for (let step = 0; step <= steps; step++) {
        const lineX = Math.round(prevX + (x - prevX) * (step / steps));
        const lineY = Math.round(prevY + (y - prevY) * (step / steps));
        if (lineX >= 0 && lineX < width && lineY >= 0 && lineY < height && grid[lineY][lineX] === ' ') {
          grid[lineY][lineX] = '-';
        }
      }
    }
  }
  
  // Add axes
  for (let i = 0; i < height; i++) {
    grid[i][0] = '|';
  }
  for (let i = 0; i < width; i++) {
    grid[height - 1][i] = '_';
  }
  grid[height - 1][0] = '+';
  
  // Convert to string
  let result = grid.map(row => row.join('')).join('\n');
  
  // Add labels
  const startTimeStr = history[0].time.toLocaleTimeString();
  const endTimeStr = history[history.length - 1].time.toLocaleTimeString();
  result += `\n${startTimeStr}${' '.repeat(Math.max(0, width - startTimeStr.length - endTimeStr.length))}${endTimeStr}\n`;
  result += `Price: ${minPrice.toFixed(4)} -> ${maxPrice.toFixed(4)} coins/token\n`;
  result += `Legend: ^ = buy, v = sell, - = price trend`;
  
  return result;
}
