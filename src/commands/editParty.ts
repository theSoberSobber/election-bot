import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { isPartyLeader, isPartyMember } from '../utils/permissions';
import { updatePublicGistAtomic } from '../storage/github';
import { getCombinedData } from '../utils/dataHelpers';

export const editPartyCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('editparty')
    .setDescription('Edit your party\'s agenda')
    .addStringOption(option =>
      option
        .setName('party')
        .setDescription('Party name')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('agenda')
        .setDescription('New party agenda/platform')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.user) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const partyName = interaction.options.getString('party', true);
    const agenda = interaction.options.getString('agenda', true);

    if (agenda.length > 500) {
      await interaction.reply({ content: 'Party agenda must be 500 characters or less.', ephemeral: true });
      return;
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      // Get election data
      const combinedData = await getCombinedData(interaction.guild.id);
      if (!combinedData) {
        await interaction.editReply({ content: '❌ No active election found.' });
        return;
      }

      const party = combinedData.election.parties[partyName];
      if (!party) {
        await interaction.editReply({ content: '❌ Party not found in this election.' });
        return;
      }

      // Check if user is party leader or member
      const isLeader = party.leaderId === interaction.user.id;
      const isMember = party.members.includes(interaction.user.id);

      if (!isLeader && !isMember) {
        await interaction.editReply({ content: '❌ Only party leaders and members can edit the party agenda.' });
        return;
      }

      // Update the agenda in election data
      await updatePublicGistAtomic(interaction.guild.id, (election) => {
        election.parties[partyName].agenda = agenda;
        return election;
      });

      await interaction.editReply({
        content: `✅ Party "${partyName}" agenda updated successfully!

**New Agenda:** ${agenda}`,
      });

    } catch (error) {
      console.error('Error editing party:', error);
      await interaction.editReply({ 
        content: `❌ Failed to edit party: ${(error as Error).message}` 
      });
    }
  },
};
