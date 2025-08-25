import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { SlashCommand } from '../types';

export const helpCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display all available ElectionBot commands'),

  async execute(interaction) {
    const helpEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('ElectionBot Commands')
      .setDescription('Here are all available commands for the ElectionBot:')
      .addFields(
        {
          name: '🗳️ Election Management',
          value: 
            '`/create` - Create a new election\n' +
            '`/listelections` - List all available elections\n' +
            '`/delete` - Delete an election (admin only)',
          inline: false
        },
        {
          name: '🏛️ Party Management', 
          value:
            '`/createparty` - Create a political party\n' +
            '`/joinparty` - Join an existing party\n' +
            '`/leaveparty` - Leave your current party\n' +
            '`/editparty` - Edit your party details\n' +
            '`/deleteparty` - Delete your party\n' +
            '`/listparties` - List all parties in an election',
          inline: false
        },
        {
          name: '💰 Campaign Finance',
          value:
            '`/balance` - Check your coin balance\n' +
            '`/transfertoparty` - Transfer coins to party vault\n' +
            '`/createbonds` - Create bonds for a party\n' +
            '`/buybonds` - Buy party bonds\n' +
            '`/sellbonds` - Sell your party bonds\n' +
            '`/settle` - Settle election results',
          inline: false
        },
        {
          name: '🗳️ Voting',
          value:
            '`/register` - Register as a voter\n' +
            '`/vote` - Cast your vote in an election\n' +
            '`/campaign` - Campaign for your party',
          inline: false
        },
        {
          name: '🔧 Utility',
          value:
            '`/resetbot` - Reset bot data (admin only)\n' +
            '`/help` - Display this help message',
          inline: false
        }
      )
      .setFooter({ 
        text: 'ElectionBot - Transparent Democratic Voting with Token-Based Campaign Finance' 
      })
      .setTimestamp();

    await interaction.reply({ 
      embeds: [helpEmbed]
    });
  },
};
