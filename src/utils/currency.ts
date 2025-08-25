/**
 * Currency utilities for standardized coin handling
 * All financial operations should use these functions to ensure consistency
 */

// All internal storage uses coins (decimal numbers)
// No more microcoins confusion!

/**
 * Converts coins to display string with consistent precision
 */
export function formatCoins(coins: number): string {
  return coins.toFixed(6);
}

/**
 * Validates coin amount (must be positive and reasonable)
 */
export function isValidCoinAmount(coins: number): boolean {
  return coins > 0 && coins <= 1000000 && Number.isFinite(coins);
}

/**
 * Validates minimum coin amount for transactions
 */
export function isMinimumCoinAmount(coins: number): boolean {
  return coins >= 0.001; // 0.001 coins minimum
}

/**
 * Safe addition of coin amounts
 */
export function addCoins(a: number, b: number): number {
  return Math.round((a + b) * 1000000) / 1000000;
}

/**
 * Safe subtraction of coin amounts
 */
export function subtractCoins(a: number, b: number): number {
  return Math.round((a - b) * 1000000) / 1000000;
}

/**
 * Safe multiplication of coin amounts
 */
export function multiplyCoins(coins: number, multiplier: number): number {
  return Math.round((coins * multiplier) * 1000000) / 1000000;
}

/**
 * Safe division of coin amounts
 */
export function divideCoins(coins: number, divisor: number): number {
  if (divisor === 0) return 0;
  return Math.round((coins / divisor) * 1000000) / 1000000;
}

/**
 * Base starting balance for all users (in coins)
 */
export const BASE_BALANCE_COINS = 100;
