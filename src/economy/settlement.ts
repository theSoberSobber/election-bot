import { Election, Party, CommonData } from '../types';
import { safeDivide, safeMultiply, safeAdd } from '../utils/numbers';

export interface SettlementResult {
  winningParty: string | null;
  combinedPool: number;
  finalPrice: number;
  tokenLiquidations: { [userId: string]: number };
  vaultDistributions: { [userId: string]: number };
  finalBalances: { [userId: string]: number }; // This is now balance CHANGES, not absolute balances
}

export function performSettlement(
  election: Election,
  winningPartyName: string | null
): SettlementResult {
  const result: SettlementResult = {
    winningParty: winningPartyName,
    combinedPool: 0,
    finalPrice: 0,
    tokenLiquidations: {},
    vaultDistributions: {},
    finalBalances: {}, // Now represents balance changes only
  };

  // Step 1: Merge all bond pools
  let combinedPool = 0;
  for (const partyName in election.parties) {
    combinedPool = safeAdd(combinedPool, election.parties[partyName].pool);
  }
  result.combinedPool = combinedPool;

  // Step 2: Compute final token price for winner
  if (winningPartyName && election.parties[winningPartyName]) {
    const winningParty = election.parties[winningPartyName];
    result.finalPrice = safeDivide(combinedPool, winningParty.issuedTokens);

    // Step 3: Liquidate winning tokens
    for (const userId in winningParty.tokenHolders) {
      const tokensHeld = winningParty.tokenHolders[userId];
      const liquidationValue = safeMultiply(tokensHeld, result.finalPrice);
      
      result.tokenLiquidations[userId] = liquidationValue;
      result.finalBalances[userId] = safeAdd(
        result.finalBalances[userId] || 0,
        liquidationValue
      );
    }

    // Step 4: Liquidate unsold winning tokens to party vault
    const unsoldTokens = winningParty.issuedTokens - winningParty.soldTokens;
    if (unsoldTokens > 0) {
      const unsoldValue = safeMultiply(unsoldTokens, result.finalPrice);
      election.parties[winningPartyName].vault = safeAdd(
        election.parties[winningPartyName].vault,
        unsoldValue
      );
    }
  }

  // Step 5: Distribute vaults per party
  for (const partyName in election.parties) {
    const party = election.parties[partyName];
    
    if (party.members.length === 0) {
      // Handle empty party vault based on configuration
      const onEmptyVault = process.env.DEFAULT_ON_EMPTY_PARTY_VAULT || 'burn';
      if (onEmptyVault === 'admin') {
        // Could implement admin reclaim logic here
        console.log(`Vault of ${party.vault} microcoins from empty party ${partyName} would go to admin`);
      } else {
        console.log(`Vault of ${party.vault} microcoins from empty party ${partyName} burned`);
      }
      continue;
    }

    const vaultSharePerMember = safeDivide(party.vault, party.members.length);
    
    for (const memberId of party.members) {
      result.vaultDistributions[memberId] = safeAdd(
        result.vaultDistributions[memberId] || 0,
        vaultSharePerMember
      );
      
      result.finalBalances[memberId] = safeAdd(
        result.finalBalances[memberId] || 0,
        vaultSharePerMember
      );
    }
  }

  return result;
}

export function getVoteResults(votes: any[]): { [partyName: string]: number } {
  const results: { [partyName: string]: number } = {};
  
  for (const vote of votes) {
    const partyName = vote.message; // The message should contain the party name
    results[partyName] = (results[partyName] || 0) + 1;
  }
  
  return results;
}

export function determineWinner(voteResults: { [partyName: string]: number }): string | null {
  let maxVotes = 0;
  let winner: string | null = null;
  let tieExists = false;

  for (const partyName in voteResults) {
    const votes = voteResults[partyName];
    if (votes > maxVotes) {
      maxVotes = votes;
      winner = partyName;
      tieExists = false;
    } else if (votes === maxVotes && maxVotes > 0) {
      tieExists = true;
    }
  }

  // If there's a tie, return null (no winner)
  return tieExists ? null : winner;
}
