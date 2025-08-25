import { calculateBondPurchase, calculateBondSale, applyBondPurchase } from '../src/economy/bonds';
import { Party } from '../src/types';

describe('Bond Economics', () => {
  const mockParty: Party = {
    name: 'TestParty',
    emoji: '🔵',
    agenda: 'Test agenda',
    leaderId: 'leader123',
    members: ['leader123'],
    vault: 0,
    pool: 50000000, // 50 coins in microcoins
    issuedTokens: 1000,
    soldTokens: 0,
    alpha: 0.6,
    k: 50000000 * 1000, // P * N
    tokenHolders: {},
  };

  test('calculateBondPurchase should work correctly', () => {
    const coinSpend = 10000000; // 10 coins
    const result = calculateBondPurchase(mockParty, coinSpend);

    expect(result.tokensAcquired).toBeGreaterThan(0);
    expect(result.poolContribution).toBe(coinSpend * mockParty.alpha);
    expect(result.vaultContribution).toBe(coinSpend * (1 - mockParty.alpha));
    expect(result.newPrice).toBeGreaterThan(0);
  });

  test('applyBondPurchase should update party state correctly', () => {
    const coinSpend = 10000000; // 10 coins
    const purchaseResult = calculateBondPurchase(mockParty, coinSpend);
    const updatedParty = applyBondPurchase(mockParty, 'user123', purchaseResult);

    expect(updatedParty.pool).toBe(mockParty.pool + purchaseResult.poolContribution);
    expect(updatedParty.vault).toBe(mockParty.vault + purchaseResult.vaultContribution);
    expect(updatedParty.soldTokens).toBe(purchaseResult.tokensAcquired);
    expect(updatedParty.tokenHolders['user123']).toBe(purchaseResult.tokensAcquired);
  });

  test('calculateBondSale should work correctly', () => {
    // First buy some tokens
    const coinSpend = 10000000;
    const purchaseResult = calculateBondPurchase(mockParty, coinSpend);
    const updatedParty = applyBondPurchase(mockParty, 'user123', purchaseResult);

    // Then try to sell some
    const tokensToSell = Math.floor(purchaseResult.tokensAcquired / 2);
    const saleResult = calculateBondSale(updatedParty, tokensToSell);

    expect(saleResult.coinsRefunded).toBeGreaterThan(0);
    expect(saleResult.newPrice).toBeGreaterThan(0);
  });
});
