import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand, Election } from '../types';
import { hasAdminRole } from '../utils/permissions';
import { generateElectionId } from '../utils/crypto';
import { createElectionGists } from '../storage/github';

const DEFAULT_DURATION_HOURS = parseInt(process.env.DEFAULT_DURATION_HOURS || '24');

export const createElectionCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create a new election')
    .addStringOption(option =>
      option
        .setName('start')
        .setDescription('Start time (ISO8601 format, defaults to now)')
        .setRequired(false)
    )
    .addNumberOption(option =>
      option
        .setName('duration')
        .setDescription('Duration in hours (default: 24)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    if (!(await hasAdminRole(interaction))) {
      await interaction.reply({ content: 'You need the `electionBotAdmin` role to use this command.', ephemeral: true });
      return;
    }

    const startParam = interaction.options.get('start')?.value as string;
    const durationParam = interaction.options.get('duration')?.value as number;

    const now = new Date();
    const startAt = startParam ? new Date(startParam) : now;
    const durationHours = durationParam || DEFAULT_DURATION_HOURS;

    // Validate inputs
    if (isNaN(startAt.getTime())) {
      await interaction.reply({ content: 'Invalid start time format. Use ISO8601 format.', ephemeral: true });
      return;
    }

    if (durationHours <= 0 || durationHours > 168) { // Max 1 week
      await interaction.reply({ content: 'Duration must be between 1 and 168 hours.', ephemeral: true });
      return;
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      const electionId = generateElectionId();
      const election: Election = {
        electionId,
        guildId: interaction.guild.id,
        createdAt: now.toISOString(),
        startAt: startAt.toISOString(),
        durationHours,
        status: startAt <= now ? 'running' : 'scheduled',
        parties: {},
        reserved: {},
        registeredVoters: {},
        meta: {
          version: 1,
          lastUpdated: now.toISOString(),
        },
      };

      const entry = await createElectionGists(interaction.guild.id, election);

      await interaction.editReply({
        content: `✅ Election created successfully!\n\n` +
                 `**Election ID:** ${electionId}\n` +
                 `**Start Time:** ${startAt.toISOString()}\n` +
                 `**Duration:** ${durationHours} hours\n` +
                 `**Status:** ${election.status}\n` +
                 `**Public Data:** https://gist.github.com/${entry.publicGistId}`,
      });

    } catch (error) {
      console.error('Error creating election:', error);
      await interaction.editReply({ content: 'Failed to create election. Please try again.' });
    }
  },
};
