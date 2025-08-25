import { GuildMember, ChatInputCommandInteraction } from 'discord.js';

export async function hasAdminRole(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!interaction.guild || !interaction.member) {
    return false;
  }

  const member = interaction.member as GuildMember;
  return member.roles.cache.some(role => role.name === 'electionBotAdmin');
}

export async function isPartyLeader(
  interaction: ChatInputCommandInteraction,
  partyName: string,
  election: any
): Promise<boolean> {
  if (!interaction.user) return false;
  
  const party = election.parties[partyName];
  return party && party.leaderId === interaction.user.id;
}

export async function isPartyMember(
  interaction: ChatInputCommandInteraction,
  partyName: string,
  election: any
): Promise<boolean> {
  if (!interaction.user) return false;
  
  const party = election.parties[partyName];
  return party && party.members.includes(interaction.user.id);
}
