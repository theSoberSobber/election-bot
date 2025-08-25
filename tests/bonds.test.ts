import { calculateBondPurchase, calculateBondSale, applyBondPurchase } from '../src/economy/bonds';
import { Party } from '../src/types';

describe('Bond Economics', () => {
  const mockParty: Party = {
    name: 'TestParty',
    emoji: '�',
    agenda: 'Test agenda',
    leaderId: 'leader123',
    members: ['leader123'],
    vault: 0,
    pool: 10000000, // 10 coins in microcoins
    issuedTokens: 10,
    soldTokens: 0,
    alpha: 1.0,
    k: 100000000, // 100 microcoins
    tokenHolders: {},
    transactions: [], // Add transaction history
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
