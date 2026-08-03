"""
Institutional Risk & Position Management Engine
Dynamic Position Sizing (1% Account Risk), RR Enforcement, Breakeven & Trailing SL, Correlation & Drawdown Limits.
"""

from typing import Dict, Any, List
from python_engine.config import (
    RISK_PER_TRADE_PCT,
    MIN_RISK_REWARD_RATIO,
    TARGET_RISK_REWARD_RATIO,
    MAX_CORRELATED_TRADES,
    MAX_DAILY_LOSS_PCT,
    MAX_WEEKLY_LOSS_PCT,
    ATR_SL_MULTIPLIER,
    ATR_TRAIL_MULTIPLIER
)

class RiskManager:
    """Institutional Risk Management and Dynamic Position Sizing Calculator."""

    @staticmethod
    def calculate_position_size(
        account_balance: float,
        entry_price: float,
        stop_loss: float,
        risk_pct: float = RISK_PER_TRADE_PCT
    ) -> Dict[str, float]:
        """Calculates exact dollar risk and position quantity based on account equity."""
        if account_balance <= 0 or entry_price <= 0:
            return {"risk_amount": 0.0, "position_size": 0.0, "position_value": 0.0}

        risk_amount = account_balance * (risk_pct / 100.0)
        risk_per_unit = abs(entry_price - stop_loss)

        if risk_per_unit <= 0:
            return {"risk_amount": 0.0, "position_size": 0.0, "position_value": 0.0}

        position_size = risk_amount / risk_per_unit
        position_value = position_size * entry_price

        return {
            "risk_amount": round(risk_amount, 2),
            "risk_per_unit": round(risk_per_unit, 4),
            "position_size": round(position_size, 4),
            "position_value": round(position_value, 2)
        }

    @staticmethod
    def calculate_atr_targets(
        side: str,
        entry_price: float,
        atr: float,
        target_rr: float = TARGET_RISK_REWARD_RATIO
    ) -> Dict[str, Any]:
        """Calculates dynamic SL and TP1/TP2/TP3 targets based on ATR and Risk/Reward."""
        sl_distance = atr * ATR_SL_MULTIPLIER if atr > 0 else entry_price * 0.02

        if side.upper() == "LONG":
            stop_loss = entry_price - sl_distance
            tp1 = entry_price + (sl_distance * 1.0)          # 1:1 RR (50% scale out + Breakeven SL)
            tp2 = entry_price + (sl_distance * 2.0)          # 2:1 RR
            tp3 = entry_price + (sl_distance * target_rr)    # 3:1+ RR Runner
        else:
            stop_loss = entry_price + sl_distance
            tp1 = entry_price - (sl_distance * 1.0)
            tp2 = entry_price - (sl_distance * 2.0)
            tp3 = entry_price - (sl_distance * target_rr)

        rr_ratio = abs(tp3 - entry_price) / abs(entry_price - stop_loss) if abs(entry_price - stop_loss) > 0 else 0.0

        return {
            "entry_price": round(entry_price, 4),
            "stop_loss": round(stop_loss, 4),
            "tp1": round(tp1, 4),
            "tp2": round(tp2, 4),
            "tp3": round(tp3, 4),
            "risk_reward_ratio": round(rr_ratio, 2),
            "sl_distance": round(sl_distance, 4)
        }

    @staticmethod
    def update_trailing_stop(
        side: str,
        entry_price: float,
        current_price: float,
        current_sl: float,
        atr: float,
        tp1_hit: bool
    ) -> float:
        """
        Updates Stop Loss to Breakeven once TP1 is hit, then trails using 1.5x ATR.
        """
        if not tp1_hit:
            return current_sl

        # Move to breakeven minimum
        new_sl = entry_price

        trail_dist = atr * ATR_TRAIL_MULTIPLIER if atr > 0 else entry_price * 0.015

        if side.upper() == "LONG":
            atr_sl = current_price - trail_dist
            new_sl = max(entry_price, current_sl, atr_sl)
        else:
            atr_sl = current_price + trail_dist
            new_sl = min(entry_price, current_sl, atr_sl)

        return round(new_sl, 4)

    @staticmethod
    def validate_portfolio_limits(
        open_trades: List[Dict[str, Any]],
        symbol: str,
        daily_pnl_pct: float,
        weekly_pnl_pct: float
    ) -> Dict[str, Any]:
        """Checks correlation limits, max daily loss (3%), and max weekly loss (8%)."""
        if daily_pnl_pct <= -MAX_DAILY_LOSS_PCT:
            return {"allowed": False, "reason": f"Maximum daily loss limit reached ({daily_pnl_pct:.2f}% <= -3%)"}

        if weekly_pnl_pct <= -MAX_WEEKLY_LOSS_PCT:
            return {"allowed": False, "reason": f"Maximum weekly loss limit reached ({weekly_pnl_pct:.2f}% <= -8%)"}

        # Duplicate symbol check
        for trade in open_trades:
            if trade.get("symbol") == symbol and not trade.get("is_resolved", False):
                return {"allowed": False, "reason": f"Active position already open on {symbol}"}

        # Correlated trades count check
        active_count = len([t for t in open_trades if not t.get("is_resolved", False)])
        if active_count >= MAX_CORRELATED_TRADES:
            return {"allowed": False, "reason": f"Maximum simultaneous active trades limit reached ({active_count}/{MAX_CORRELATED_TRADES})"}

        return {"allowed": True, "reason": "Portfolio limits clear"}
