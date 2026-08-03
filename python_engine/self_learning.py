"""
Self-Learning & Strategy Optimization Engine
Analyzes closed trades, compares winning vs losing setups, identifies win-rate drivers,
and generates empirical parameter optimization suggestions.
"""

from typing import List, Dict, Any, Optional

class SelfLearningEngine:
    """Self-learning module for quantitative strategy self-optimization."""

    @staticmethod
    def analyze_trade_performance(trades: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Performs deep post-trade analysis on closed historical trades.
        Compares indicator distributions between winning and losing trades.
        """
        if not trades:
            return {"status": "error", "message": "No trade data available for self-learning analysis"}

        completed_trades = [t for t in trades if t.get("status") in ["WIN", "LOSS"]]
        if not completed_trades:
            return {"status": "error", "message": "No resolved WIN/LOSS trades found"}

        winners = [t for t in completed_trades if t.get("status") == "WIN"]
        losers = [t for t in completed_trades if t.get("status") == "LOSS"]

        # Indicator Averages Comparison
        def get_avg(lst: List[Dict[str, Any]], key: str) -> float:
            vals = [float(t.get(key, 0.0)) for t in lst if key in t and t.get(key) is not None]
            return sum(vals) / len(vals) if vals else 0.0

        avg_win_confidence = get_avg(winners, "confidence_score")
        avg_loss_confidence = get_avg(losers, "confidence_score")

        avg_win_adx = get_avg(winners, "adx")
        avg_loss_adx = get_avg(losers, "adx")

        avg_win_vol_ratio = get_avg(winners, "volume_ratio")
        avg_loss_vol_ratio = get_avg(losers, "volume_ratio")

        avg_win_holding = get_avg(winners, "holding_bars")
        avg_loss_holding = get_avg(losers, "holding_bars")

        # Top & Worst Performing Symbols
        symbols = {}
        for t in completed_trades:
            sym = t.get("symbol", "UNKNOWN")
            if sym not in symbols:
                symbols[sym] = {"trades": 0, "wins": 0, "losses": 0, "pnl": 0.0}
            symbols[sym]["trades"] += 1
            if t.get("status") == "WIN": symbols[sym]["wins"] += 1
            else: symbols[sym]["losses"] += 1
            symbols[sym]["pnl"] += float(t.get("pnl_dollars", 0.0))

        symbol_stats = []
        for sym, data in symbols.items():
            wr = (data["wins"] / data["trades"]) * 100.0 if data["trades"] > 0 else 0.0
            symbol_stats.append({
                "symbol": sym,
                "trades": data["trades"],
                "win_rate": round(wr, 1),
                "net_pnl": round(data["pnl"], 2)
            })

        symbol_stats.sort(key=lambda x: x["win_rate"], reverse=True)
        top_symbols = symbol_stats[:3]
        worst_symbols = symbol_stats[-3:]

        # Empirical Parameter Optimization Recommendations
        optimizations = []

        if avg_win_confidence > avg_loss_confidence + 5:
            optimizations.append(
                f"Increase minimum Confidence Score threshold from 65 to {round(avg_win_confidence - 2)} "
                f"(Winners avg {avg_win_confidence:.1f} vs Losers {avg_loss_confidence:.1f})"
            )

        if avg_win_adx > 30 and avg_loss_adx < 25:
            optimizations.append(
                f"Raise minimum ADX filter threshold to 30 for stronger trend filtering "
                f"(Winning setups averaged ADX={avg_win_adx:.1f})"
            )

        if avg_win_vol_ratio > 1.8:
            optimizations.append(
                f"Increase Volume Expansion filter requirement from 1.5x to 1.8x 20MA "
                f"(Winning setups had avg volume ratio {avg_win_vol_ratio:.2f}x)"
            )

        if not optimizations:
            optimizations.append("Current parameters are optimally calibrated based on historical sample size.")

        return {
            "total_analyzed": len(completed_trades),
            "winner_count": len(winners),
            "loser_count": len(losers),
            "indicator_deltas": {
                "avg_confidence": {"winners": round(avg_win_confidence, 1), "losers": round(avg_loss_confidence, 1)},
                "avg_adx": {"winners": round(avg_win_adx, 1), "losers": round(avg_loss_adx, 1)},
                "avg_volume_ratio": {"winners": round(avg_win_vol_ratio, 2), "losers": round(avg_loss_vol_ratio, 2)},
                "avg_holding_bars": {"winners": round(avg_win_holding, 1), "losers": round(avg_loss_holding, 1)}
            },
            "top_performing_symbols": top_symbols,
            "worst_performing_symbols": worst_symbols,
            "suggested_parameter_optimizations": optimizations
        }
