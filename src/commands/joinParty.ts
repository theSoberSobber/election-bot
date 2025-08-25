import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { SlashCommand } from '../types';
import { getPublicGist, updatePublicGistAtomic } from '../storage/github';
import { getCombinedData } from '../utils/dataHelpers';

export const joinPartyCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('joinparty')
    .setDescription('Request to join a political party')
    .addStringOption(option =>
      option
        .setName('election')
        .setDescription('Election name or ID')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('party')
        .setDescription('Party name to join')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.user) {
      await interaction.reply({ content: 'This command can only be used in a server.' });
      return;
    }

    const electionName = interaction.options.getString('election', true);
    const partyName = interaction.options.getString('party', true);

    try {
      await interaction.deferReply();

      // Get combined data
      const combinedData = await getCombinedData(interaction.guild.id);
      if (!combinedData) {
        await interaction.editReply({ content: '❌ No active election found.' });
        return;
      }

      const party = combinedData.election.parties[partyName];
      if (!party) {
        await interaction.editReply({ content: `❌ Party "${partyName}" not found in this election.` });
        return;
      }

      const userId = interaction.user.id;

      // Check if user is already in this party
      if (party.members.includes(userId)) {
        await interaction.editReply({ content: `❌ You are already a member of ${partyName}.` });
        return;
      }

      // Check if user is in any other party in this election
      for (const pName in combinedData.election.parties) {
        if (combinedData.election.parties[pName].members.includes(userId)) {
          await interaction.editReply({ content: `❌ You are already a member of ${pName}. Leave that party first.` });
          return;
        }
      }

      const leaderId = party.leaderId;

      // Send join request to party leader
      const requestMessage = await interaction.editReply({
        content: `🗳️ **Join Request for ${party.emoji} ${partyName}**\n\n` +
                 `<@${leaderId}>, <@${userId}> wants to join your party!\n\n` +
                 `**Party Agenda:** ${party.agenda}`,
        components: [
          new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`approve_${userId}_${partyName}`)
                .setLabel('✅ Approve')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`reject_${userId}_${partyName}`)
                .setLabel('❌ Reject')
                .setStyle(ButtonStyle.Danger)
            ),
        ],
      });

      // Create collector for button interactions
      const collector = requestMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000, // 5 minutes
      });

      collector.on('collect', async (buttonInteraction) => {
        // Only party leader can respond
        console.log(buttonInteraction.user.id, leaderId);
        if (buttonInteraction.user.id !== leaderId) {
          await buttonInteraction.reply({
            content: '❌ Only the party leader can respond to join requests.'
          });
          return;
        }

        const [action, requesterId, partyNameFromId] = buttonInteraction.customId.split('_');

        if (action === 'approve') {
          try {
            // Add user to party in election data
            await updatePublicGistAtomic(interaction.guild!.id, (election) => {
              if (election.parties[partyName]) {
                election.parties[partyName].members.push(userId);
              }
              return election;
            });

            await buttonInteraction.update({
              content: `✅ **Join Request Approved!**\n\n<@${userId}> has been added to ${party.emoji} ${partyName}.`,
              components: [],
            });
          } catch (error) {
            await buttonInteraction.update({
              content: `❌ Failed to add member: ${(error as Error).message}`,
              components: [],
            });
          }
        } else if (action === 'reject') {
          await buttonInteraction.update({
            content: `❌ **Join Request Rejected**\n\n<@${userId}>, your request to join ${party.emoji} ${partyName} was declined.`,
            components: [],
          });
        }
      });

      collector.on('end', async () => {
        try {
          await interaction.editReply({
            content: `⏰ **Join Request Expired**\n\nThe request to join ${partyName} has timed out.`,
            components: [],
          });
        } catch (error) {
          // Message might already be updated
        }
      });

    } catch (error) {
      console.error('Error with join party request:', error);
      await interaction.editReply({ 
        content: `❌ Failed to process join request: ${(error as Error).message}` 
      });
    }
  },
};
