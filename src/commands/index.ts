import { Collection } from 'discord.js';
import { SlashCommand } from '../types';
import { createElectionCommand } from './createElection';
import { createPartyCommand } from './createParty';
import { joinPartyCommand } from './joinParty';
import { leavePartyCommand } from './leaveParty';
import { editPartyCommand } from './editParty';
import { deletePartyCommand } from './deleteParty';
import { createBondsCommand } from './createBonds';
import { buyBondsCommand } from './buyBonds';
import { sellBondsCommand } from './sellBonds';
import { registerVoterCommand } from './registerVoter';
import { voteCommand } from './vote';
import { listPartiesCommand } from './listParties';
import { listElectionsCommand } from './listElections';
import { campaignCommand } from './campaign';
import { deleteElectionCommand } from './deleteElection';
import { settleElectionCommand } from './settleElection';
import { resetBotCommand } from './resetBot';
import { helpCommand } from './help';

export async function initializeCommands(commands: Collection<string, SlashCommand>): Promise<void> {
  const commandList = [
    createElectionCommand,
    createPartyCommand,
    joinPartyCommand,
    leavePartyCommand,
    editPartyCommand,
    deletePartyCommand,
    createBondsCommand,
    buyBondsCommand,
    sellBondsCommand,
    registerVoterCommand,
    voteCommand,
    listPartiesCommand,
    listElectionsCommand,
    campaignCommand,
    deleteElectionCommand,
    settleElectionCommand,
    resetBotCommand,
    helpCommand,
  ];

  for (const command of commandList) {
    commands.set(command.data.name, command);
  }

  console.log(`Loaded ${commandList.length} commands`);
}
