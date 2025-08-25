import { performSettlement, getVoteResults, determineWinner } from '../src/economy/settlement';
import { Election, Party, CommonData } from '../src/types';

describe('Settlement Logic', () => {
  const mockElection: Election = {
    electionId: 'test-election',
    name: 'Test Election',
    guildId: 'test-guild',
    createdAt: '2024-01-01T00:00:00.000Z',
    startAt: '2024-01-01T00:00:00.000Z',
    durationHours: 24,
    status: 'ended',
    parties: {
      PartyA: {
        name: 'PartyA',
        emoji: '�',
        agenda: 'Red agenda',
        leaderId: 'leader1',
        members: ['leader1', 'member1'],
        vault: 5000000, // 5 coins
        pool: 15000000, // 15 coins
        issuedTokens: 100,
        soldTokens: 20,
        alpha: 0.7,
        k: 0,
        tokenHolders: { 'holder1': 10000000, 'holder2': 10000000 }, // 10M microcoins each
        transactions: [],
      },
      PartyB: {
        name: 'PartyB',
        emoji: '�',
        agenda: 'Yellow agenda',
        leaderId: 'leader2',
        members: ['leader2'],
        vault: 8000000, // 8 coins
        pool: 12000000, // 12 coins
        issuedTokens: 50,
        soldTokens: 10,
        alpha: 0.5,
        k: 0,
        tokenHolders: { 'holder3': 10000000 }, // 10M microcoins
        transactions: [],
      },
    },
    reserved: {},
    registeredVoters: {},
    meta: {
      version: 1,
      lastUpdated: '2024-01-01T00:00:00.000Z'
    }
  };

  const mockCommonData: CommonData = {
    guildId: 'test-guild',
    balances: {
      'holder1': 100000000, // 100 coins
      'holder2': 50000000,  // 50 coins
      'holder3': 75000000,  // 75 coins
    },
    meta: {
      version: 1,
      lastUpdated: '2024-01-01T00:00:00.000Z'
    }
  };

  test('getVoteResults should count votes correctly', () => {
    const votes = [
      { voterId: 'voter1', message: 'PartyA', signature: 'sig1', timestamp: '2024-01-01T01:00:00.000Z' },
      { voterId: 'voter2', message: 'PartyA', signature: 'sig2', timestamp: '2024-01-01T01:00:00.000Z' },
      { voterId: 'voter3', message: 'PartyB', signature: 'sig3', timestamp: '2024-01-01T01:00:00.000Z' },
    ];

    const results = getVoteResults(votes);
    expect(results['PartyA']).toBe(2);
    expect(results['PartyB']).toBe(1);
  });

  test('determineWinner should return correct winner', () => {
    const voteResults = { PartyA: 3, PartyB: 1 };
    const winner = determineWinner(voteResults);
    expect(winner).toBe('PartyA');

    const tieResults = { PartyA: 2, PartyB: 2 };
    const tieWinner = determineWinner(tieResults);
    expect(tieWinner).toBeNull();
  });

  test('performSettlement should calculate correctly', () => {
    const settlement = performSettlement(mockElection, 'PartyA');

    expect(settlement.winningParty).toBe('PartyA');
    expect(settlement.combinedPool).toBe(50000000); // 30 + 20 coins
    expect(settlement.finalPrice).toBe(50000); // 50 coins / 1000 tokens
    expect(settlement.tokenLiquidations['holder1']).toBe(300 * 50000); // 300 tokens * price
    expect(settlement.tokenLiquidations['holder2']).toBe(200 * 50000); // 200 tokens * price
  });
});
