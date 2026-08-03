"""
AI Quality Control (QC) Reject Filter Module
Validates trade setups against strict institutional quality filters prior to order dispatch.
"""

from typing import Dict, Any, List

class AIQualityControl:
    """AI-driven pre-trade filter engine to eliminate low-probability setups."""

    @staticmethod
    def audit_trade_setup(
        symbol: str,
        confidence_score: float,
        risk_reward_ratio: float,
        atr: float,
        atr_min: float,
        spread: float,
        max_spread: float,
        is_news_window: bool,
        liquidity_ok: bool,
        trend_clear: bool,
        has_conflicting_signals: bool,
        is_duplicate: bool
    ) -> Dict[str, Any]:
        """
        Audits candidate setup. Rejects trade if ANY institutional check fails.
        """
        rejection_reasons = []

        if confidence_score < 65:
            rejection_reasons.append(f"Confidence score below minimum threshold ({confidence_score:.1f} < 65)")

        if risk_reward_ratio < 2.0:
            rejection_reasons.append(f"Risk/Reward ratio insufficient ({risk_reward_ratio:.2f}:1 < 2.0:1)")

        if atr < atr_min:
            rejection_reasons.append(f"ATR volatility squeeze ({atr:.4f} < min {atr_min:.4f})")

        if spread > max_spread and max_spread > 0:
            rejection_reasons.append(f"Spread too high ({spread:.4f} > max {max_spread:.4f})")

        if is_news_window:
            rejection_reasons.append("High impact economic news scheduled within 30 minutes")

        if not liquidity_ok:
            rejection_reasons.append("Illiquid session / Equal Highs-Lows trap detected")

        if not trend_clear:
            rejection_reasons.append("Market regime unclear / EMA 50-200 flat")

        if has_conflicting_signals:
            rejection_reasons.append("Conflicting indicator signals (e.g. bullish UTBot against bearish MACD)")

        if is_duplicate:
            rejection_reasons.append("Duplicate signal setup already active for symbol")

        passed = len(rejection_reasons) == 0

        return {
            "passed": passed,
            "decision": "SEND" if passed else "REJECT",
            "rejection_reasons": rejection_reasons,
            "summary": "Trade passed AI Quality Control" if passed else f"Rejected by AI QC: {'; '.join(rejection_reasons)}"
        }
