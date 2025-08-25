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
  
  // Simple pricing model: price = pool / remainingTokens
  return safeDivide(party.pool, remainingTokens);
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
  
  // Simple model: we need to solve for how many tokens to give
  // Current price = pool / remainingTokens
  // We want to distribute tokens proportionally to the money added
  // tokensAcquired = poolContribution / averagePrice
  // averagePrice = (currentPool + newPool) / (2 * currentRemainingTokens)
  
  const currentPrice = safeDivide(party.pool, currentRemainingTokens);
  const tokensAcquired = Math.min(
    roundToMicrocoins(safeDivide(poolContribution, currentPrice)),
    currentRemainingTokens - 1 // Always leave at least 1 token
  );

  if (tokensAcquired <= 0) {
    throw new Error('Insufficient coin spend to acquire tokens');
  }

  const newRemainingTokens = currentRemainingTokens - tokensAcquired;
  const newPrice = safeDivide(newPool, newRemainingTokens);

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

  const soldTokens = party.soldTokens;
  if (tokensToSell > soldTokens) {
    throw new Error('Cannot sell more tokens than have been sold');
  }

  const currentRemainingTokens = party.issuedTokens - party.soldTokens;
  const newRemainingTokens = safeAdd(currentRemainingTokens, tokensToSell);
  
  // Simple model: refund based on current price
  const currentPrice = safeDivide(party.pool, currentRemainingTokens);
  const coinsRefunded = roundToMicrocoins(safeMultiply(tokensToSell, currentPrice));
  
  const newPool = safeSubtract(party.pool, coinsRefunded);
  const newPrice = safeDivide(newPool, newRemainingTokens);

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
