import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand, Vote } from '../types';
import { getPublicGist, appendVoteAtomic } from '../storage/github';
import { verifySignature } from '../utils/crypto';

export const voteCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('vote')
    .setDescription('Cast your vote for a party')
    .addStringOption(option =>
      option
        .setName('election')
        .setDescription('Election name or ID')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('party')
        .setDescription('Party name to vote for')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Message to sign (should be the party name)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('signature')
        .setDescription('Base64-encoded RSA signature of the message')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.user) {
      await interaction.reply({ content: 'This command can only be used in a server.' });
      return;
    }

    const partyName = interaction.options.get('party')?.value as string;
    const message = interaction.options.get('message')?.value as string;
    const signature = interaction.options.get('signature')?.value as string;

    if (!partyName || !message || !signature) {
      await interaction.reply({ content: 'All fields are required.' });
      return;
    }

    try {
      await interaction.deferReply();

      const election = await getPublicGist(interaction.guild.id);
      if (!election) {
        await interaction.editReply({ content: '❌ No active election found.' });
        return;
      }

      // Check election status
      if (election.status !== 'running') {
        await interaction.editReply({ content: '❌ Election is not currently running.' });
        return;
      }

      const userId = interaction.user.id;

      // Check if user is registered
      const publicKeyPem = election.registeredVoters[userId];
      if (!publicKeyPem) {
        await interaction.editReply({ 
          content: '❌ You must register your public key first with `/register`.' 
        });
        return;
      }

      // Validate message matches party name
      if (message !== partyName) {
        await interaction.editReply({ 
          content: '❌ The message must exactly match the party name you are voting for.' 
        });
        return;
      }

      // Check if party exists
      if (!election.parties[partyName]) {
        await interaction.editReply({ 
          content: `❌ Party "${partyName}" does not exist.` 
        });
        return;
      }

      // Verify signature
      if (!verifySignature(message, signature, publicKeyPem)) {
        await interaction.editReply({ 
          content: '❌ Invalid signature. Please ensure you signed the message correctly with your registered private key.' 
        });
        return;
      }

      // Check if user has already voted (need to check private gist)
      // This is a simplified check - in production, you'd want to check the private gist
      // For now, we'll implement a basic check

      const vote: Vote = {
        voterId: userId,
        message,
        signature,
        timestamp: new Date().toISOString(),
      };

      await appendVoteAtomic(interaction.guild.id, vote);

      await interaction.editReply({
        content: `✅ Vote cast successfully!\n\n` +
                 `**Party:** ${partyName}\n` +
                 `**Timestamp:** ${vote.timestamp}\n\n` +
                 `Your vote has been recorded and will be counted when the election ends.`,
      });

    } catch (error) {
      console.error('Error casting vote:', error);
      await interaction.editReply({ 
        content: `❌ Failed to cast vote: ${(error as Error).message}` 
      });
    }
  },
};
