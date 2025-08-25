import Decimal from 'decimal.js';

// Configure Decimal.js for high precision
Decimal.config({ precision: 20, rounding: Decimal.ROUND_DOWN });

export function safeDivide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  
  const result = new Decimal(a).div(new Decimal(b));
  return result.toNumber();
}

export function safeMultiply(a: number, b: number): number {
  const result = new Decimal(a).mul(new Decimal(b));
  return result.toNumber();
}

export function safeAdd(a: number, b: number): number {
  const result = new Decimal(a).add(new Decimal(b));
  return result.toNumber();
}

export function safeSubtract(a: number, b: number): number {
  const result = new Decimal(a).sub(new Decimal(b));
  return result.toNumber();
}

export function roundToMicrocoins(value: number): number {
  return Math.round(value);
}

export function validatePositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

export function validateRange(value: number, min: number, max: number, name: string): void {
  if (value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
}
