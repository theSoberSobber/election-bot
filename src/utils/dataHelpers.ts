import { Election, CommonData } from '../types';
import { getPublicGist, getCommonGist } from '../storage/github';

export interface CombinedData {
  election: Election;
  commonData: CommonData;
}

export async function getCombinedData(guildId: string): Promise<CombinedData | null> {
  const [election, commonData] = await Promise.all([
    getPublicGist(guildId),
    getCommonGist(guildId)
  ]);

  if (!election || !commonData) {
    return null;
  }

  return { election, commonData };
}

export function getFullPartyInfo(partyName: string, combinedData: CombinedData) {
  const party = combinedData.election.parties[partyName];
  
  if (!party) {
    return null;
  }

  return {
    party,
    commonData: combinedData.commonData
  };
}
