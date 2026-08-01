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

/**
 * Calculates position size in tokens for Crypto/Linear Perpetual accounts.
 * Formula: (capital × riskPct) / |entryPrice − stopLoss|
 * Minimum size: 0.000001 tokens.
 *
 * @param capital      - Total account capital in USD
 * @param riskPct      - Risk percentage as decimal (e.g. 0.02 = 2%)
 * @param entryPrice   - Trade entry price
 * @param stopLoss     - Stop loss price
 * @returns            - Position size in tokens (6 decimal places)
 */
export function calculateCryptoPositionSize(
  capital: number,
  riskPct: number,
  entryPrice: number,
  stopLoss: number
): number {
  const cap   = new BigNumber(capital);
  const risk  = new BigNumber(riskPct);
  const entry = new BigNumber(entryPrice);
  const sl    = new BigNumber(stopLoss);

  const slDist = entry.minus(sl).abs();
  if (slDist.isZero() || cap.isZero() || risk.isZero()) return 0;

  const qty = cap.multipliedBy(risk).dividedBy(slDist);
  const minimum = new BigNumber("0.000001");
  return BigNumber.maximum(qty, minimum).decimalPlaces(6).toNumber();
}

/**
 * Calculates Forex position size in micro-lots (0.01 lot = 1,000 units).
 * Uses risk-based sizing and floors to minimum 0.01 micro-lot.
 *
 * @param capital     - Total account capital in USD
 * @param riskPct     - Risk percentage as decimal (e.g. 0.02 = 2%)
 * @param entryPrice  - Trade entry price (e.g. 1.0850 for EURUSD)
 * @param stopLoss    - Stop loss price
 * @returns           - Position size in lots (e.g. 0.01)
 */
export function calculateForexLots(
  capital: number,
  riskPct: number,
  entryPrice: number,
  stopLoss: number
): number {
  const cap   = new BigNumber(capital);
  const risk  = new BigNumber(riskPct);
  const entry = new BigNumber(entryPrice);
  const sl    = new BigNumber(stopLoss);

  const slDist = entry.minus(sl).abs();
  if (slDist.isZero() || cap.isZero() || risk.isZero()) return 0.01;

  // Raw units at risk / sl distance gives quantity in base currency units
  const riskAmount = cap.multipliedBy(risk); // e.g. $2 on $100
  const units = riskAmount.dividedBy(slDist);

  // Convert to lots: 1 standard lot = 100,000 units; 1 micro-lot = 1,000 units = 0.01 lots
  const lots = units.dividedBy(100000);
  // Floor to 0.01 micro-lot precision
  const microLots = lots.dividedBy(0.01).integerValue(BigNumber.ROUND_FLOOR).multipliedBy(0.01);
  const minimum = new BigNumber("0.01");
  return BigNumber.maximum(microLots, minimum).toNumber();
}

/**
 * Checks whether a proposed position margin is within the safe threshold.
 * Rule: margin must not exceed 20% of total capital.
 *
 * @param positionMarginUsd - Margin required for the position in USD
 * @param capitalUsd        - Total account capital in USD
 * @returns true if safe, false if margin exceeds 20% of capital
 */
export function isMarginSafe(positionMarginUsd: number, capitalUsd: number): boolean {
  if (capitalUsd <= 0) return false;
  return positionMarginUsd <= capitalUsd * 0.20;
}
