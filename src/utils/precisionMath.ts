import BigNumber from "bignumber.js";

/**
 * Ensures micro-cap tokens (e.g. SHIB, PEPE) aren't rounded to 0.
 * Dynamic decimal formatting.
 */
export function formatPrecision(value: number | string): string {
  const bn = new BigNumber(value);
  if (bn.isNaN()) return "0.00";
  
  const abs = bn.abs();
  if (abs.isZero()) return "0.00";
  if (abs.isLessThan(0.0001)) {
    // Drop trailing zeros for micro-caps but keep up to 8 decimals
    return bn.decimalPlaces(8).toString();
  } else if (abs.isLessThan(1)) {
    return bn.decimalPlaces(4).toString();
  } else {
    return bn.decimalPlaces(2).toString();
  }
}

export function calcPnL(side: "LONG" | "SHORT", entryPrice: number | string, currentPrice: number | string, quantity: number | string = 1): number {
  const entry = new BigNumber(entryPrice);
  const current = new BigNumber(currentPrice);
  const qty = new BigNumber(quantity);
  
  if (entry.isNaN() || current.isNaN() || qty.isNaN()) return 0;

  if (side === "LONG") {
    return current.minus(entry).multipliedBy(qty).toNumber();
  } else {
    return entry.minus(current).multipliedBy(qty).toNumber();
  }
}

export function calcPnLPct(side: "LONG" | "SHORT", entryPrice: number | string, currentPrice: number | string): number {
  const entry = new BigNumber(entryPrice);
  const current = new BigNumber(currentPrice);
  
  if (entry.isNaN() || current.isNaN() || entry.isZero()) return 0;
  
  if (side === "LONG") {
    return current.minus(entry).dividedBy(entry).multipliedBy(100).toNumber();
  } else {
    return entry.minus(current).dividedBy(entry).multipliedBy(100).toNumber();
  }
}
