import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder } from 'discord.js';

export interface SlashCommand {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface Party {
  name: string;
  emoji: string;
  agenda: string;
  leaderId: string;
  members: string[];
  vault: number; // microcoins
  pool: number; // microcoins
  issuedTokens: number;
  soldTokens: number;
  alpha: number;
  k: number; // constant product k = P * N
  tokenHolders: { [userId: string]: number };
}

export interface Election {
  electionId: string;
  name: string;
  guildId: string;
  createdAt: string;
  startAt: string;
  durationHours: number;
  status: 'scheduled' | 'running' | 'ended' | 'finalized';
  parties: { [partyName: string]: Party };
  reserved: { [userId: string]: number }; // pending reservations in microcoins
  registeredVoters: { [userId: string]: string }; // userId -> PEM public key
  meta: {
    version: number;
    lastUpdated: string;
  };
}

// New: Common persistent data across elections
export interface CommonData {
  guildId: string;
  balances: { [userId: string]: number }; // persistent user balance adjustments in microcoins
  meta: {
    version: number;
    lastUpdated: string;
  };
}

export interface Vote {
  voterId: string;
  message: string;
  signature: string;
  timestamp: string;
}

export interface PrivateGist {
  electionId: string;
  votes: Vote[];
}

export interface GistIndexEntry {
  publicGistId: string; // Election-specific gist
  privateGistId: string; // Election votes gist
  commonGistId: string; // Persistent data gist (NEW)
  electionId: string;
  createdAt: string;
}

export interface GistIndex {
  maintainer: string;
  entries: { [guildId: string]: GistIndexEntry };
}

export interface BondTransaction {
  type: 'buy' | 'sell';
  userId: string;
  partyName: string;
  coins: number;
  tokens: number;
  timestamp: string;
}

export interface CampaignPost {
  partyName: string;
  userId: string;
  headline: string;
  body: string;
  cost: number;
  timestamp: string;
}
