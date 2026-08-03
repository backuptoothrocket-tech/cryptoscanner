"""
Multi-Timeframe (MTF) Alignment Engine
Rules:
4H determines higher timeframe trend.
1H confirms intermediate direction.
15m locates trading setup.
5m triggers execution entry.
STRICTLY NO counter-trend trades allowed.
"""

from typing import List, Dict, Any

class MTFAnalyzer:
    """Evaluates multi-timeframe trend confluences across 4H, 1H, 15m, and 5m timeframes."""

    @staticmethod
    def evaluate_mtf_confluence(
        is_buy: bool,
        tf_4h_trend: str,
        tf_1h_trend: str,
        tf_15m_trend: str,
        tf_5m_trigger: str
    ) -> Dict[str, Any]:
        """
        Validates whether all 4 timeframes align without counter-trend contradiction.
        """
        required_direction = "bullish" if is_buy else "bearish"

        tf_4h_aligned = tf_4h_trend.lower() == required_direction
        tf_1h_aligned = tf_1h_trend.lower() == required_direction
        tf_15m_aligned = tf_15m_trend.lower() == required_direction
        tf_5m_aligned = tf_5m_trigger.lower() == required_direction

        # 4H and 1H must strictly align with the trade direction (no counter-trend trades)
        is_valid_mtf = tf_4h_aligned and tf_1h_aligned and tf_15m_aligned

        alignment_score = 0
        if tf_4h_aligned: alignment_score += 4
        if tf_1h_aligned: alignment_score += 3
        if tf_15m_aligned: alignment_score += 2
        if tf_5m_aligned: alignment_score += 1

        details = [
            f"4H Trend: {tf_4h_trend.upper()} ({'✅' if tf_4h_aligned else '❌'})",
            f"1H Confirm: {tf_1h_trend.upper()} ({'✅' if tf_1h_aligned else '❌'})",
            f"15m Setup: {tf_15m_trend.upper()} ({'✅' if tf_15m_aligned else '❌'})",
            f"5m Trigger: {tf_5m_trigger.upper()} ({'✅' if tf_5m_aligned else '❌'})",
        ]

        reason = ""
        if not tf_4h_aligned:
            reason = f"Trade side ({required_direction}) contradicts 4H macro trend ({tf_4h_trend})."
        elif not tf_1h_aligned:
            reason = f"Trade side ({required_direction}) contradicts 1H confirmation trend ({tf_1h_trend})."

        return {
            "is_valid_mtf": is_valid_mtf,
            "alignment_score": alignment_score,  # Out of 10
            "tf_4h_aligned": tf_4h_aligned,
            "tf_1h_aligned": tf_1h_aligned,
            "tf_15m_aligned": tf_15m_aligned,
            "tf_5m_aligned": tf_5m_aligned,
            "details": details,
            "rejection_reason": reason
        }
