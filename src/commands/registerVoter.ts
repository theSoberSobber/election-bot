import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { getPublicGist, updatePublicGistAtomic } from '../storage/github';
import { parsePublicKey } from '../utils/crypto';

export const registerVoterCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register your RSA public key for voting')
    .addStringOption(option =>
      option
        .setName('publickey')
        .setDescription('Your RSA public key in PEM format')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.user) {
      await interaction.reply({ content: 'This command can only be used in a server.' });
      return;
    }

    const publicKeyPem = interaction.options.get('publickey')?.value as string;

    if (!publicKeyPem) {
      await interaction.reply({ content: 'Public key is required.' });
      return;
    }

    // Validate the public key
    if (!parsePublicKey(publicKeyPem)) {
      await interaction.reply({ 
        content: 'Invalid RSA public key. Please provide a valid PEM-formatted RSA public key.' 
      });
      return;
    }

    try {
      await interaction.deferReply();

      const updated = await updatePublicGistAtomic(interaction.guild.id, (election) => {
        if (!election) {
          throw new Error('No active election found');
        }

        if (election.status === 'ended' || election.status === 'finalized') {
          throw new Error('Cannot register for ended election');
        }

        const userId = interaction.user!.id;

        // Check if already registered
        if (election.registeredVoters[userId]) {
          throw new Error('You are already registered for this election');
        }

        // Register the voter
        election.registeredVoters[userId] = publicKeyPem;

        return election;
      });

      await interaction.editReply({
        content: `✅ Successfully registered for voting!\n\n` +
                 `Your RSA public key has been recorded. You can now vote using the \`/vote\` command with a properly signed message.`,
      });

    } catch (error) {
      console.error('Error registering voter:', error);
      await interaction.editReply({ 
        content: `❌ Failed to register: ${(error as Error).message}` 
      });
    }
  },
};
