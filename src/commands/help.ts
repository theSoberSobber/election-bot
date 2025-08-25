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
            '`/create-election` - Create a new election\n' +
            '`/list-elections` - List all available elections\n' +
            '`/delete-election` - Delete an election (owner only)',
          inline: false
        },
        {
          name: '🏛️ Campaign Management', 
          value:
            '`/register-candidate` - Register as a candidate in an election\n' +
            '`/list-candidates` - List all candidates in an election\n' +
            '`/create-party` - Create a political party\n' +
            '`/join-party` - Join an existing party\n' +
            '`/list-parties` - List all parties in an election',
          inline: false
        },
        {
          name: '💰 Campaign Finance',
          value:
            '`/check-balance` - Check your token balance\n' +
            '`/donate` - Donate tokens to a candidate\n' +
            '`/bond` - Post a performance bond for your candidacy\n' +
            '`/settle` - Settle campaign finances after election ends',
          inline: false
        },
        {
          name: '🗳️ Voting',
          value:
            '`/start-vote` - Start voting phase for an election\n' +
            '`/vote` - Cast your vote in an election\n' +
            '`/end-election` - End an election and tally results',
          inline: false
        },
        {
          name: '🔧 Utility',
          value:
            '`/ping` - Check if the bot is responsive\n' +
            '`/help` - Display this help message',
          inline: false
        }
      )
      .setFooter({ 
        text: 'ElectionBot - Transparent Democratic Voting with Token-Based Campaign Finance' 
      })
      .setTimestamp();

    await interaction.reply({ 
      embeds: [helpEmbed], 
      ephemeral: true 
    });
  },
};
