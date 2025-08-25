import { Party } from '../types';
import { safeDivide, safeMultiply, safeAdd, safeSubtract, roundToMicrocoins } from '../utils/numbers';

export interface BondPurchaseResult {
  tokensAcquired: number;
  poolContribution: number;
  vaultContribution: number;
  newPrice: number;
}

export interface BondSaleResult {
  coinsRefunded: number;
  newPrice: number;
}

export function calculateTokenPrice(party: Party): number {
  const remainingTokens = party.issuedTokens - party.soldTokens;
  if (remainingTokens <= 0) {
    throw new Error('No tokens available for purchase');
  }
  
  return safeDivide(party.k, remainingTokens);
}

export function calculateBondPurchase(
  party: Party,
  coinSpend: number
): BondPurchaseResult {
  if (coinSpend <= 0) {
    throw new Error('Coin spend must be positive');
  }

  const poolContribution = roundToMicrocoins(safeMultiply(party.alpha, coinSpend));
  const vaultContribution = coinSpend - poolContribution;

  const currentRemainingTokens = party.issuedTokens - party.soldTokens;
  const newPool = safeAdd(party.pool, poolContribution);
  const newRemainingTokens = safeDivide(party.k, newPool);
  const tokensAcquired = roundToMicrocoins(
    safeSubtract(currentRemainingTokens, newRemainingTokens)
  );

  if (tokensAcquired <= 0) {
    throw new Error('Insufficient coin spend to acquire tokens');
  }

  const newPrice = safeDivide(party.k, newRemainingTokens);

  return {
    tokensAcquired,
    poolContribution,
    vaultContribution,
    newPrice,
  };
}

export function calculateBondSale(
  party: Party,
  tokensToSell: number
): BondSaleResult {
  if (tokensToSell <= 0) {
    throw new Error('Tokens to sell must be positive');
  }

  const currentRemainingTokens = party.issuedTokens - party.soldTokens;
  if (tokensToSell > currentRemainingTokens) {
    throw new Error('Cannot sell more tokens than remaining supply');
  }

  const newRemainingTokens = safeAdd(currentRemainingTokens, tokensToSell);
  const newPool = safeDivide(party.k, newRemainingTokens);
  const coinsRefunded = roundToMicrocoins(safeSubtract(party.pool, newPool));

  if (coinsRefunded <= 0) {
    throw new Error('No coins can be refunded for these tokens');
  }

  const newPrice = safeDivide(party.k, newRemainingTokens);

  return {
    coinsRefunded,
    newPrice,
  };
}

export function applyBondPurchase(
  party: Party,
  userId: string,
  purchase: BondPurchaseResult
): Party {
  const updatedParty = { ...party };
  
  updatedParty.pool = safeAdd(party.pool, purchase.poolContribution);
  updatedParty.vault = safeAdd(party.vault, purchase.vaultContribution);
  updatedParty.soldTokens = safeAdd(party.soldTokens, purchase.tokensAcquired);
  
  updatedParty.tokenHolders = { ...party.tokenHolders };
  updatedParty.tokenHolders[userId] = safeAdd(
    party.tokenHolders[userId] || 0,
    purchase.tokensAcquired
  );
  
  return updatedParty;
}

export function applyBondSale(
  party: Party,
  userId: string,
  tokensSold: number,
  sale: BondSaleResult
): Party {
  const updatedParty = { ...party };
  
  updatedParty.pool = safeSubtract(party.pool, sale.coinsRefunded);
  updatedParty.soldTokens = safeSubtract(party.soldTokens, tokensSold);
  
  updatedParty.tokenHolders = { ...party.tokenHolders };
  const currentTokens = party.tokenHolders[userId] || 0;
  const newTokens = safeSubtract(currentTokens, tokensSold);
  
  if (newTokens <= 0) {
    delete updatedParty.tokenHolders[userId];
  } else {
    updatedParty.tokenHolders[userId] = newTokens;
  }
  
  return updatedParty;
}
