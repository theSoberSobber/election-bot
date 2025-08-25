import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand, Party } from '../types';
import { hasAdminRole, isPartyLeader, isPartyMember } from '../utils/permissions';
import { getPublicGist, updatePublicGistAtomic } from '../storage/github';

export const createPartyCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('createparty')
    .setDescription('Create a new political party')
    .addStringOption(option =>
      option
        .setName('election')
        .setDescription('Election name or ID')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Party name')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('emoji')
        .setDescription('Party emoji')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('agenda')
        .setDescription('Party agenda/platform')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.user) {
      await interaction.reply({ content: 'This command can only be used in a server.' });
      return;
    }

    const electionName = interaction.options.get('election')?.value as string;
    const name = interaction.options.get('name')?.value as string;
    const emoji = interaction.options.get('emoji')?.value as string;
    const agenda = interaction.options.get('agenda')?.value as string;

    if (!electionName || !name || !emoji || !agenda) {
      await interaction.reply({ content: 'All fields are required.' });
      return;
    }

    // Validate party name (alphanumeric and spaces only)
    if (!/^[a-zA-Z0-9\s]+$/.test(name)) {
      await interaction.reply({ content: 'Party name can only contain letters, numbers, and spaces.' });
      return;
    }

    if (name.length > 50) {
      await interaction.reply({ content: 'Party name must be 50 characters or less.' });
      return;
    }

    if (agenda.length > 500) {
      await interaction.reply({ content: 'Party agenda must be 500 characters or less.' });
      return;
    }

    try {
      await interaction.deferReply();

      // Get current election and common data
      const election = await getPublicGist(interaction.guild.id);
      if (!election) {
        await interaction.editReply({ content: '❌ No active election found.' });
        return;
      }

      if (election.status === 'ended' || election.status === 'finalized') {
        await interaction.editReply({ content: '❌ Cannot create parties in ended election.' });
        return;
      }

      // Check if party name already exists in election
      if (election.parties[name]) {
        await interaction.editReply({ content: '❌ Party name already exists in this election.' });
        return;
      }

      // Check if user is already in a party in this election
      for (const partyName in election.parties) {
        const party = election.parties[partyName];
        if (party.members.includes(interaction.user.id)) {
          await interaction.editReply({ content: '❌ You are already a member of another party in this election.' });
          return;
        }
      }

      // Create party in election data
      await updatePublicGistAtomic(interaction.guild.id, (election) => {
        const newParty: Party = {
          name,
          emoji,
          agenda,
          leaderId: interaction.user!.id,
          members: [interaction.user!.id],
          vault: 0,
          pool: 0,
          issuedTokens: 0,
          soldTokens: 0,
          alpha: 0,
          k: 0,
          tokenHolders: {},
          transactions: [], // Initialize transaction history
        };

        election.parties[name] = newParty;
        return election;
      });

      await interaction.editReply({
        content: `✅ Party "${name}" ${emoji} created successfully!\n\n` +
                 `**Leader:** <@${interaction.user.id}>\n` +
                 `**Agenda:** ${agenda}\n\n` +
                 `You can now issue election bonds with \`/createbonds\`.`,
      });

    } catch (error) {
      console.error('Error creating party:', error);
      await interaction.editReply({ 
        content: `❌ Failed to create party: ${(error as Error).message}` 
      });
    }
  },
};
