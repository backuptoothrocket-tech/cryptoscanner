"""
Smart Money Concepts (SMC) & Market Structure Analyzer
Detects BOS, CHOCH, FVG, Order Blocks, Liquidity Sweeps, Mitigation Blocks, and Premium/Discount Zones.
"""

from typing import List, Dict, Any, Optional

class SMCAnalyzer:
    """Analyzes market structure and SMC elements from OHLCV candle data."""

    @staticmethod
    def detect_swing_points(highs: List[float], lows: List[float], window: int = 2) -> Dict[str, List[Dict[str, Any]]]:
        """Detect swing highs and swing lows using a left/right pivot window."""
        n = len(highs)
        swing_highs = []
        swing_lows = []

        for i in range(window, n - window):
            is_sh = True
            is_sl = True
            for w in range(1, window + 1):
                if highs[i] <= highs[i - w] or highs[i] <= highs[i + w]:
                    is_sh = False
                if lows[i] >= lows[i - w] or lows[i] >= lows[i + w]:
                    is_sl = False

            if is_sh:
                swing_highs.append({"index": i, "price": highs[i]})
            if is_sl:
                swing_lows.append({"index": i, "price": lows[i]})

        return {"swing_highs": swing_highs, "swing_lows": swing_lows}

    @staticmethod
    def detect_market_structure(opens: List[float], highs: List[float], lows: List[float], closes: List[float]) -> Dict[str, Any]:
        """Identify BOS (Break of Structure), CHOCH (Change of Character), HH/HL & LH/LL trend."""
        pivots = SMCAnalyzer.detect_swing_points(highs, lows, window=2)
        shs = pivots["swing_highs"]
        sls = pivots["swing_lows"]

        n = len(closes)
        if n < 5 or len(shs) < 2 or len(sls) < 2:
            return {
                "structure_type": "none",
                "trend": "neutral",
                "has_hh_hl": False,
                "has_lh_ll": False,
                "bos": False,
                "choch": False
            }

        last_close = closes[-1]
        prev_sh = shs[-1]["price"]
        prev_sl = sls[-1]["price"]
        prior_sh = shs[-2]["price"]
        prior_sl = sls[-2]["price"]

        has_hh_hl = prev_sh > prior_sh and prev_sl > prior_sl
        has_lh_ll = prev_sh < prior_sh and prev_sl < prior_sl

        bos = False
        choch = False
        structure_type = "none"
        trend = "neutral"

        if has_hh_hl:
            trend = "bullish"
            if last_close > prev_sh:
                bos = True
                structure_type = "BOS"
        elif has_lh_ll:
            trend = "bearish"
            if last_close < prev_sl:
                bos = True
                structure_type = "BOS"

        # CHOCH check (Reversal across structure)
        if not bos:
            if trend == "bearish" and last_close > prev_sh:
                choch = True
                structure_type = "CHOCH"
                trend = "bullish"
            elif trend == "bullish" and last_close < prev_sl:
                choch = True
                structure_type = "CHOCH"
                trend = "bearish"

        return {
            "structure_type": structure_type,
            "trend": trend,
            "has_hh_hl": has_hh_hl,
            "has_lh_ll": has_lh_ll,
            "bos": bos,
            "choch": choch,
            "swing_high": prev_sh,
            "swing_low": prev_sl
        }

    @staticmethod
    def detect_fair_value_gaps(highs: List[float], lows: List[float], closes: List[float]) -> List[Dict[str, Any]]:
        """Identify Fair Value Gaps (FVG) across 3-bar sequences."""
        fvgs = []
        n = len(closes)
        if n < 3:
            return fvgs

        for i in range(2, n):
            # Bullish FVG: Low of bar i > High of bar i-2
            if lows[i] > highs[i - 2]:
                gap_size = lows[i] - highs[i - 2]
                fvgs.append({
                    "type": "bullish",
                    "index": i,
                    "top": lows[i],
                    "bottom": highs[i - 2],
                    "size": gap_size
                })
            # Bearish FVG: High of bar i < Low of bar i-2
            elif highs[i] < lows[i - 2]:
                gap_size = lows[i - 2] - highs[i]
                fvgs.append({
                    "type": "bearish",
                    "index": i,
                    "top": lows[i - 2],
                    "bottom": highs[i],
                    "size": gap_size
                })

        return fvgs

    @staticmethod
    def detect_order_blocks(opens: List[float], highs: List[float], lows: List[float], closes: List[float], volumes: List[float]) -> List[Dict[str, Any]]:
        """Detect Bullish and Bearish Order Blocks (OB)."""
        obs = []
        n = len(closes)
        if n < 5:
            return obs

        for i in range(2, n - 1):
            # Bullish Order Block: Last bearish candle prior to a strong bullish move
            if closes[i] < opens[i]:  # Bearish candle
                if closes[i + 1] > opens[i + 1] and (closes[i + 1] - opens[i + 1]) > (highs[i] - lows[i]):
                    obs.append({
                        "type": "bullish",
                        "index": i,
                        "high": highs[i],
                        "low": lows[i],
                        "open": opens[i],
                        "close": closes[i]
                    })
            # Bearish Order Block: Last bullish candle prior to a strong bearish drop
            elif closes[i] > opens[i]:  # Bullish candle
                if closes[i + 1] < opens[i + 1] and (opens[i + 1] - closes[i + 1]) > (highs[i] - lows[i]):
                    obs.append({
                        "type": "bearish",
                        "index": i,
                        "high": highs[i],
                        "low": lows[i],
                        "open": opens[i],
                        "close": closes[i]
                    })

        return obs

    @staticmethod
    def detect_liquidity_sweeps(highs: List[float], lows: List[float], closes: List[float]) -> List[Dict[str, Any]]:
        """Identify liquidity sweeps (wick spikes beyond swing points that quickly reclaim)."""
        sweeps = []
        pivots = SMCAnalyzer.detect_swing_points(highs, lows, window=2)
        n = len(closes)
        if n < 3:
            return sweeps

        for sh in pivots["swing_highs"]:
            sh_idx = sh["index"]
            sh_price = sh["price"]
            for i in range(sh_idx + 1, n):
                if highs[i] > sh_price and closes[i] < sh_price:
                    sweeps.append({
                        "type": "bearish_sweep",  # Buy-side liquidity swept
                        "index": i,
                        "level": sh_price
                    })

        for sl in pivots["swing_lows"]:
            sl_idx = sl["index"]
            sl_price = sl["price"]
            for i in range(sl_idx + 1, n):
                if lows[i] < sl_price and closes[i] > sl_price:
                    sweeps.append({
                        "type": "bullish_sweep",  # Sell-side liquidity swept
                        "index": i,
                        "level": sl_price
                    })

        return sweeps

    @staticmethod
    def evaluate_premium_discount(highs: List[float], lows: List[float], current_price: float) -> Dict[str, Any]:
        """Determine if current price is in Discount Zone (<50% range) or Premium Zone (>50% range)."""
        if not highs or not lows:
            return {"zone": "neutral", "equilibrium": current_price}

        range_high = max(highs[-50:])
        range_low = min(lows[-50:])
        equilibrium = (range_high + range_low) / 2.0

        if current_price < equilibrium:
            zone = "discount"
        else:
            zone = "premium"

        return {
            "zone": zone,
            "range_high": range_high,
            "range_low": range_low,
            "equilibrium": equilibrium
        }

    @staticmethod
    def evaluate_smc_confluences(opens: List[float], highs: List[float], lows: List[float], closes: List[float], volumes: List[float], is_buy: bool) -> Dict[str, Any]:
        """
        Evaluate full SMC suite and require at least TWO valid SMC confirmations.
        Confirmations include: BOS, CHOCH, FVG, Order Block, Liquidity Sweep, Mitigation Block, Premium/Discount.
        """
        struct = SMCAnalyzer.detect_market_structure(opens, highs, lows, closes)
        fvgs = SMCAnalyzer.detect_fair_value_gaps(highs, lows, closes)
        obs = SMCAnalyzer.detect_order_blocks(opens, highs, lows, closes, volumes)
        sweeps = SMCAnalyzer.detect_liquidity_sweeps(highs, lows, closes)
        pd_zone = SMCAnalyzer.evaluate_premium_discount(highs, lows, closes[-1])

        confirmations = []

        # 1. BOS
        if struct["bos"]:
            confirmations.append("Break of Structure (BOS)")
        # 2. CHOCH
        if struct["choch"]:
            confirmations.append("Change of Character (CHOCH)")

        # 3. FVG
        target_fvg_type = "bullish" if is_buy else "bearish"
        recent_fvgs = [f for f in fvgs if f["type"] == target_fvg_type and f["index"] >= len(closes) - 5]
        if recent_fvgs:
            confirmations.append("Fair Value Gap (FVG)")

        # 4. Order Block
        target_ob_type = "bullish" if is_buy else "bearish"
        recent_obs = [o for o in obs if o["type"] == target_ob_type and o["index"] >= len(closes) - 8]
        if recent_obs:
            confirmations.append("Order Block (OB)")

        # 5. Liquidity Sweep
        target_sweep_type = "bullish_sweep" if is_buy else "bearish_sweep"
        recent_sweeps = [s for s in sweeps if s["type"] == target_sweep_type and s["index"] >= len(closes) - 5]
        if recent_sweeps:
            confirmations.append("Liquidity Sweep")

        # 6. Mitigation Block (OB that mitigated price action)
        if len(recent_obs) > 1:
            confirmations.append("Mitigation Block")

        # 7. Premium / Discount
        if is_buy and pd_zone["zone"] == "discount":
            confirmations.append("Discount Zone (Buy Low)")
        elif not is_buy and pd_zone["zone"] == "premium":
            confirmations.append("Premium Zone (Sell High)")

        has_min_smc = len(confirmations) >= 2

        return {
            "has_min_smc": has_min_smc,
            "smc_count": len(confirmations),
            "confirmations": confirmations,
            "structure": struct,
            "premium_discount": pd_zone
        }
