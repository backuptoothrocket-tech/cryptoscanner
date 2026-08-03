"""
Institutional Weighted Scoring Engine (110 Points Maximum)
Scores trade setups across 8 technical components and categorizes confidence into tiers.
"""

from typing import Dict, Any
from python_engine.config import (
    WEIGHT_TREND,
    WEIGHT_MARKET_STRUCTURE,
    WEIGHT_VOLUME,
    WEIGHT_MOMENTUM,
    WEIGHT_SMC,
    WEIGHT_VOLATILITY,
    WEIGHT_RISK_REWARD,
    WEIGHT_HTF_ALIGNMENT,
    MAX_SCORE,
    MIN_CONFIDENCE_SCORE
)

class ScoringEngine:
    """Evaluates and scores trade setups out of 110 points."""

    @staticmethod
    def calculate_score(
        price: float,
        ema50: float,
        ema200: float,
        is_buy: bool,
        market_structure: Dict[str, Any],
        volume_curr: float,
        volume_ma: float,
        rsi: float,
        macd_hist: float,
        smc_results: Dict[str, Any],
        atr: float,
        atr_min: float,
        risk_reward_ratio: float,
        mtf_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculates total weighted score and returns detailed breakdown."""

        breakdown = {}
        total_score = 0

        # 1. Trend Filter (25 pts)
        # Long: Price > EMA200 AND EMA50 > EMA200
        # Short: Price < EMA200 AND EMA50 < EMA200
        if is_buy:
            trend_passed = price > ema200 and ema50 > ema200
        else:
            trend_passed = price < ema200 and ema50 < ema200

        if trend_passed:
            score_trend = WEIGHT_TREND
            breakdown["Trend Alignment (EMA 50/200)"] = WEIGHT_TREND
        else:
            score_trend = 0
            breakdown["Trend Counter/Unclear"] = 0
        total_score += score_trend

        # 2. Market Structure (20 pts)
        # Long: HH & HL, Short: LH & LL + BOS/CHOCH
        ms_trend = market_structure.get("trend", "")
        has_struct = market_structure.get("bos", False) or market_structure.get("choch", False)
        if (is_buy and ms_trend == "bullish") or (not is_buy and ms_trend == "bearish"):
            score_ms = 10
            if has_struct:
                score_ms += 10
            breakdown["Market Structure (HH/HL / LH/LL + Structure)"] = score_ms
        else:
            score_ms = 0
            breakdown["Market Structure Neutral"] = 0
        total_score += score_ms

        # 3. Volume Expansion Filter (15 pts)
        # Volume > 1.5 x 20-candle average
        vol_ratio = volume_curr / volume_ma if volume_ma > 0 else 0.0
        if vol_ratio >= 1.5:
            score_vol = WEIGHT_VOLUME
            breakdown[f"Volume Expansion ({vol_ratio:.2f}x > 1.5x)"] = WEIGHT_VOLUME
        elif vol_ratio >= 1.0:
            score_vol = 8
            breakdown[f"Volume Average ({vol_ratio:.2f}x)"] = 8
        else:
            score_vol = 0
            breakdown[f"Volume Low ({vol_ratio:.2f}x)"] = 0
        total_score += score_vol

        # 4. Momentum (RSI + MACD) (15 pts)
        score_mom = 0
        if is_buy:
            if rsi <= 40: score_mom += 8  # Oversold / Pullback value
            elif rsi <= 60: score_mom += 4
            if macd_hist > 0: score_mom += 7
        else:
            if rsi >= 60: score_mom += 8  # Overbought / Rally value
            elif rsi >= 40: score_mom += 4
            if macd_hist < 0: score_mom += 7
        breakdown["Momentum (RSI & MACD)"] = score_mom
        total_score += score_mom

        # 5. SMC Confluence (15 pts)
        # Requires >= 2 SMC confirmations
        smc_count = smc_results.get("smc_count", 0)
        if smc_count >= 3:
            score_smc = WEIGHT_SMC
        elif smc_count == 2:
            score_smc = 10
        elif smc_count == 1:
            score_smc = 5
        else:
            score_smc = 0
        breakdown[f"SMC Confluences ({smc_count} Confirmations)"] = score_smc
        total_score += score_smc

        # 6. Volatility Filter (5 pts)
        if atr >= atr_min and atr > 0:
            score_volatility = WEIGHT_VOLATILITY
            breakdown[f"Volatility (ATR {atr:.2f} >= {atr_min:.2f})"] = WEIGHT_VOLATILITY
        else:
            score_volatility = 0
            breakdown["Volatility Low Squeeze"] = 0
        total_score += score_volatility

        # 7. Risk/Reward Ratio (5 pts)
        if risk_reward_ratio >= 3.0:
            score_rr = WEIGHT_RISK_REWARD
            breakdown[f"Risk/Reward Ideal ({risk_reward_ratio:.2f}:1)"] = WEIGHT_RISK_REWARD
        elif risk_reward_ratio >= 2.0:
            score_rr = 3
            breakdown[f"Risk/Reward Minimum ({risk_reward_ratio:.2f}:1)"] = 3
        else:
            score_rr = 0
            breakdown[f"Risk/Reward Reject ({risk_reward_ratio:.2f}:1)"] = 0
        total_score += score_rr

        # 8. HTF Alignment (10 pts)
        mtf_score = mtf_results.get("alignment_score", 0)  # out of 10
        score_htf = mtf_score
        breakdown[f"HTF Multi-Timeframe Confluence ({mtf_score}/10)"] = score_htf
        total_score += score_htf

        # Confidence Tier Determination
        if total_score >= 95:
            tier = "Elite Trade"
            action = "STRONG BUY/SELL"
        elif total_score >= 85:
            tier = "A+ Trade"
            action = "BUY/SELL"
        elif total_score >= 75:
            tier = "A Trade"
            action = "BUY/SELL"
        elif total_score >= 65:
            tier = "B Trade"
            action = "CAUTIOUS BUY/SELL"
        else:
            tier = "Below Threshold (<65)"
            action = "DO NOT TRADE"

        passed = total_score >= MIN_CONFIDENCE_SCORE and trend_passed and smc_results.get("has_min_smc", False)

        return {
            "total_score": total_score,
            "max_score": MAX_SCORE,
            "tier": tier,
            "action": action,
            "passed": passed,
            "breakdown": breakdown
        }
