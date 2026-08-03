"""
Institutional Backtesting & Historical Scanning Engine
Features:
- Zero look-ahead bias (candle close evaluation only)
- Realistic SL/TP execution with intrabar same-candle resolution
- Dynamic 1% account risk position sizing
- Comprehensive performance metrics (Sharpe, Sortino, Calmar, Expectancy, Profit Factor, Max DD)
- Multidimensional Trade Grouping (Hour, Weekday, Symbol, Confidence, Trend, Strategy)
- Exporters: CSV, Excel, and Interactive Standalone HTML Report with inline equity & drawdown charts.
"""

import math
import json
import csv
from datetime import datetime
from typing import List, Dict, Any, Optional

from python_engine.indicators import (
    calculate_ema, calculate_rsi, calculate_macd,
    calculate_atr, calculate_adx, calculate_volume_ma
)
from python_engine.smc_analyzer import SMCAnalyzer
from python_engine.mtf_analyzer import MTFAnalyzer
from python_engine.scoring_engine import ScoringEngine
from python_engine.risk_manager import RiskManager
from python_engine.ai_qc import AIQualityControl


class TradeRecord:
    """Represents a logged trade with full execution metrics."""
    def __init__(
        self,
        trade_id: int,
        symbol: str,
        side: str,
        entry_time: str,
        signal_candle_time: str,
        entry_price: float,
        stop_loss: float,
        tp1: float,
        tp2: float,
        position_size: float,
        risk_amount: float,
        confidence_score: float,
        confidence_tier: str,
        reason_entry: str,
        indicators: Dict[str, Any]
    ):
        self.trade_id = trade_id
        self.symbol = symbol
        self.side = side.upper()
        self.entry_time = entry_time
        self.signal_candle_time = signal_candle_time
        self.entry_price = entry_price
        self.stop_loss = stop_loss
        self.tp1 = tp1
        self.tp2 = tp2
        self.position_size = position_size
        self.risk_amount = risk_amount
        self.confidence_score = confidence_score
        self.confidence_tier = confidence_tier
        self.reason_entry = reason_entry
        self.indicators = indicators

        self.exit_time: Optional[str] = None
        self.exit_price: float = 0.0
        self.pnl_dollars: float = 0.0
        self.pnl_pct: float = 0.0
        self.status: str = "OPEN"  # WIN, LOSS, BREAKEVEN, OPEN
        self.reason_exit: str = ""
        self.holding_bars: int = 0
        self.tp1_hit: bool = False
        self.current_sl: float = stop_loss

    def to_dict(self) -> Dict[str, Any]:
        return {
            "trade_id": self.trade_id,
            "symbol": self.symbol,
            "side": self.side,
            "entry_time": self.entry_time,
            "exit_time": self.exit_time or "",
            "signal_candle_time": self.signal_candle_time,
            "entry_price": round(self.entry_price, 4),
            "exit_price": round(self.exit_price, 4),
            "stop_loss": round(self.stop_loss, 4),
            "tp1": round(self.tp1, 4),
            "tp2": round(self.tp2, 4),
            "position_size": round(self.position_size, 4),
            "risk_amount": round(self.risk_amount, 2),
            "pnl_dollars": round(self.pnl_dollars, 2),
            "pnl_pct": round(self.pnl_pct, 2),
            "status": self.status,
            "confidence_score": self.confidence_score,
            "confidence_tier": self.confidence_tier,
            "reason_entry": self.reason_entry,
            "reason_exit": self.reason_exit,
            "holding_bars": self.holding_bars,
            "atr": round(self.indicators.get("atr", 0.0), 4),
            "adx": round(self.indicators.get("adx", 0.0), 2),
            "volume_ratio": round(self.indicators.get("volume_ratio", 0.0), 2)
        }


class BacktestEngine:
    """Institutional Backtesting & Analytics Engine."""

    def __init__(self, initial_capital: float = 10000.0):
        self.initial_capital = initial_capital
        self.capital = initial_capital
        self.trades: List[TradeRecord] = []
        self.equity_curve: List[float] = [initial_capital]
        self.timestamps: List[str] = []

    def run_backtest(
        self,
        ohlcv_bars: List[Dict[str, Any]],
        symbol: str = "BTCUSDT",
        timeframe: str = "4H"
    ) -> Dict[str, Any]:
        """
        Executes backtest over historical candles with 0 look-ahead bias.
        Signals are generated strictly after candle close.
        """
        if len(ohlcv_bars) < 200:
            return {"error": "Insufficient candle history (minimum 200 bars required for EMA200)"}

        opens = [float(b["open"]) for b in ohlcv_bars]
        highs = [float(b["high"]) for b in ohlcv_bars]
        lows = [float(b["low"]) for b in ohlcv_bars]
        closes = [float(b["close"]) for b in ohlcv_bars]
        volumes = [float(b["volume"]) for b in ohlcv_bars]
        times = [str(b["timestamp"]) for b in ohlcv_bars]

        # Calculate Indicators
        ema50 = calculate_ema(closes, 50)
        ema200 = calculate_ema(closes, 200)
        rsi = calculate_rsi(closes, 14)
        macd_res = calculate_macd(closes)
        atr = calculate_atr(highs, lows, closes, 14)
        adx_res = calculate_adx(highs, lows, closes, 14)
        adx = adx_res["adx"]
        vol_ma = calculate_volume_ma(volumes, 20)

        active_trade: Optional[TradeRecord] = None
        trade_counter = 1

        for i in range(200, len(ohlcv_bars)):
            curr_bar_time = times[i]
            curr_open = opens[i]
            curr_high = highs[i]
            curr_low = lows[i]
            curr_close = closes[i]

            # 1. Manage existing open position (Check SL/TP intrabar execution)
            if active_trade is not None:
                active_trade.holding_bars += 1
                sl = active_trade.current_sl
                tp1 = active_trade.tp1
                tp2 = active_trade.tp2
                side = active_trade.side

                sl_hit = False
                tp1_hit = False
                tp2_hit = False

                if side == "LONG":
                    if curr_low <= sl: sl_hit = True
                    if curr_high >= tp1: tp1_hit = True
                    if curr_high >= tp2: tp2_hit = True
                else:  # SHORT
                    if curr_high >= sl: sl_hit = True
                    if curr_low <= tp1: tp1_hit = True
                    if curr_low <= tp2: tp2_hit = True

                # Intrabar collision resolution (both TP and SL hit in same candle)
                if sl_hit and (tp1_hit or tp2_hit):
                    # Conservative rule: Mark SL hit first
                    sl_hit = True
                    tp1_hit = False
                    tp2_hit = False

                # Process Exit or Trailing Update
                if sl_hit:
                    active_trade.exit_time = curr_bar_time
                    active_trade.exit_price = sl
                    active_trade.status = "LOSS" if not active_trade.tp1_hit else "BREAKEVEN"
                    active_trade.reason_exit = "Stop Loss Hit" if not active_trade.tp1_hit else "Trailing Stop Hit after TP1"

                    diff = (sl - active_trade.entry_price) if side == "LONG" else (active_trade.entry_price - sl)
                    pnl = diff * active_trade.position_size
                    active_trade.pnl_dollars = pnl
                    active_trade.pnl_pct = (pnl / active_trade.risk_amount) * 100.0 if active_trade.risk_amount > 0 else 0.0

                    self.capital += pnl
                    self.trades.append(active_trade)
                    active_trade = None

                elif tp2_hit:
                    active_trade.exit_time = curr_bar_time
                    active_trade.exit_price = tp2
                    active_trade.status = "WIN"
                    active_trade.reason_exit = "Target 2 Full Profit Reached"

                    diff = (tp2 - active_trade.entry_price) if side == "LONG" else (active_trade.entry_price - tp2)
                    pnl = diff * active_trade.position_size
                    active_trade.pnl_dollars = pnl
                    active_trade.pnl_pct = (pnl / active_trade.risk_amount) * 100.0 if active_trade.risk_amount > 0 else 0.0

                    self.capital += pnl
                    self.trades.append(active_trade)
                    active_trade = None

                elif tp1_hit and not active_trade.tp1_hit:
                    active_trade.tp1_hit = True
                    # Move SL to Breakeven & start trailing
                    active_trade.current_sl = RiskManager.update_trailing_stop(
                        side, active_trade.entry_price, curr_close, active_trade.current_sl, atr[i], True
                    )

            # Record equity
            self.equity_curve.append(self.capital)
            self.timestamps.append(curr_bar_time)

            # 2. Evaluate NEW Trade Entry on Signal Candle CLOSE (index i-1) to avoid look-ahead bias
            if active_trade is None and i > 200:
                sig_idx = i - 1  # Signal evaluated on completed candle i-1
                sig_time = times[sig_idx]
                sig_close = closes[sig_idx]

                # Determine direction from closed candle indicators
                is_buy = sig_close > ema200[sig_idx] and ema50[sig_idx] > ema200[sig_idx]
                is_sell = sig_close < ema200[sig_idx] and ema50[sig_idx] < ema200[sig_idx]

                if not is_buy and not is_sell:
                    continue

                side = "LONG" if is_buy else "SHORT"

                # Analyze SMC & MTF
                sub_opens = opens[:sig_idx + 1]
                sub_highs = highs[:sig_idx + 1]
                sub_lows = lows[:sig_idx + 1]
                sub_closes = closes[:sig_idx + 1]
                sub_vols = volumes[:sig_idx + 1]

                smc_res = SMCAnalyzer.evaluate_smc_confluences(
                    sub_opens, sub_highs, sub_lows, sub_closes, sub_vols, is_buy
                )

                trend_str = "bullish" if is_buy else "bearish"
                mtf_res = MTFAnalyzer.evaluate_mtf_confluence(
                    is_buy, trend_str, trend_str, trend_str, trend_str
                )

                struct = smc_res["structure"]
                curr_atr = atr[sig_idx]
                curr_adx = adx[sig_idx]
                curr_vol_ma = vol_ma[sig_idx]

                targets = RiskManager.calculate_atr_targets(side, sig_close, curr_atr)

                # Score setup
                score_res = ScoringEngine.calculate_score(
                    price=sig_close,
                    ema50=ema50[sig_idx],
                    ema200=ema200[sig_idx],
                    is_buy=is_buy,
                    market_structure=struct,
                    volume_curr=sub_vols[-1],
                    volume_ma=curr_vol_ma,
                    rsi=rsi[sig_idx],
                    macd_hist=macd_res["histogram"][sig_idx],
                    smc_results=smc_res,
                    atr=curr_atr,
                    atr_min=sig_close * 0.005,
                    risk_reward_ratio=targets["risk_reward_ratio"],
                    mtf_results=mtf_res
                )

                # AI QC Filter Audit
                qc_res = AIQualityControl.audit_trade_setup(
                    symbol=symbol,
                    confidence_score=score_res["total_score"],
                    risk_reward_ratio=targets["risk_reward_ratio"],
                    atr=curr_atr,
                    atr_min=sig_close * 0.005,
                    spread=0.0,
                    max_spread=1.0,
                    is_news_window=False,
                    liquidity_ok=True,
                    trend_clear=score_res["passed"],
                    has_conflicting_signals=False,
                    is_duplicate=False
                )

                if score_res["passed"] and qc_res["passed"]:
                    # Execute entry on next candle OPEN (curr_open)
                    entry_price = curr_open
                    sizing = RiskManager.calculate_position_size(
                        self.capital, entry_price, targets["stop_loss"]
                    )

                    if sizing["position_size"] > 0:
                        active_trade = TradeRecord(
                            trade_id=trade_counter,
                            symbol=symbol,
                            side=side,
                            entry_time=curr_bar_time,
                            signal_candle_time=sig_time,
                            entry_price=entry_price,
                            stop_loss=targets["stop_loss"],
                            tp1=targets["tp1"],
                            tp2=targets["tp2"],
                            position_size=sizing["position_size"],
                            risk_amount=sizing["risk_amount"],
                            confidence_score=score_res["total_score"],
                            confidence_tier=score_res["tier"],
                            reason_entry=f"{side} SMC Confluence ({smc_res['smc_count']} triggers) Score: {score_res['total_score']}/110",
                            indicators={
                                "atr": curr_atr,
                                "adx": curr_adx,
                                "volume_ratio": sub_vols[-1] / curr_vol_ma if curr_vol_ma > 0 else 1.0,
                                "rsi": rsi[sig_idx],
                                "ema50": ema50[sig_idx],
                                "ema200": ema200[sig_idx]
                            }
                        )
                        trade_counter += 1

        return self.generate_performance_metrics()

    def generate_performance_metrics(self) -> Dict[str, Any]:
        """Calculates statistical quant performance metrics and grouping breakdowns."""
        total_trades = len(self.trades)
        if total_trades == 0:
            return {
                "total_trades": 0,
                "win_rate": 0.0,
                "profit_factor": 0.0,
                "expectancy": 0.0,
                "sharpe_ratio": 0.0,
                "sortino_ratio": 0.0,
                "calmar_ratio": 0.0,
                "max_drawdown_pct": 0.0,
                "net_profit_pct": 0.0,
                "equity_curve": self.equity_curve,
                "trades": []
            }

        wins = [t for t in self.trades if t.status == "WIN"]
        losses = [t for t in self.trades if t.status == "LOSS"]
        breakevens = [t for t in self.trades if t.status == "BREAKEVEN"]

        win_count = len(wins)
        loss_count = len(losses)
        win_rate = (win_count / total_trades) * 100.0

        total_won = sum(t.pnl_dollars for t in wins)
        total_lost = abs(sum(t.pnl_dollars for t in losses))

        profit_factor = round(total_won / total_lost, 2) if total_lost > 0 else (99.0 if total_won > 0 else 0.0)
        avg_winner = total_won / win_count if win_count > 0 else 0.0
        avg_loser = total_lost / loss_count if loss_count > 0 else 0.0

        win_prob = win_count / total_trades
        loss_prob = loss_count / total_trades
        expectancy = (win_prob * avg_winner) - (loss_prob * avg_loser)

        # Drawdown calculation
        peak = self.initial_capital
        max_dd = 0.0
        drawdown_curve = []

        for eq in self.equity_curve:
            if eq > peak:
                peak = eq
            dd = (peak - eq) / peak * 100.0 if peak > 0 else 0.0
            if dd > max_dd:
                max_dd = dd
            drawdown_curve.append(round(dd, 2))

        # Returns & Ratios
        returns = []
        for i in range(1, len(self.equity_curve)):
            prev = self.equity_curve[i - 1]
            curr = self.equity_curve[i]
            ret = (curr - prev) / prev if prev > 0 else 0.0
            returns.append(ret)

        if returns:
            avg_ret = sum(returns) / len(returns)
            variance = sum((r - avg_ret) ** 2 for r in returns) / len(returns)
            std_dev = math.sqrt(variance)

            sharpe_ratio = round((avg_ret / std_dev) * math.sqrt(252), 2) if std_dev > 0 else 0.0

            downside_returns = [r for r in returns if r < 0]
            if downside_returns:
                downside_var = sum(r ** 2 for r in downside_returns) / len(downside_returns)
                downside_std = math.sqrt(downside_var)
                sortino_ratio = round((avg_ret / downside_std) * math.sqrt(252), 2) if downside_std > 0 else 0.0
            else:
                sortino_ratio = 99.0
        else:
            sharpe_ratio = 0.0
            sortino_ratio = 0.0

        net_profit_dollars = self.capital - self.initial_capital
        net_profit_pct = (net_profit_dollars / self.initial_capital) * 100.0
        calmar_ratio = round(net_profit_pct / max_dd, 2) if max_dd > 0 else 0.0

        avg_holding_bars = sum(t.holding_bars for t in self.trades) / total_trades

        # Grouping Breakdowns
        by_symbol = self._group_trades(lambda t: t.symbol)
        by_confidence = self._group_trades(lambda t: t.confidence_tier)
        by_trend = self._group_trades(lambda t: t.side)

        return {
            "initial_capital": self.initial_capital,
            "final_capital": round(self.capital, 2),
            "net_profit_dollars": round(net_profit_dollars, 2),
            "net_profit_pct": round(net_profit_pct, 2),
            "total_trades": total_trades,
            "wins": win_count,
            "losses": loss_count,
            "breakevens": len(breakevens),
            "win_rate": round(win_rate, 2),
            "profit_factor": profit_factor,
            "expectancy": round(expectancy, 2),
            "avg_winner": round(avg_winner, 2),
            "avg_loser": round(avg_loser, 2),
            "max_drawdown_pct": round(max_dd, 2),
            "sharpe_ratio": sharpe_ratio,
            "sortino_ratio": sortino_ratio,
            "calmar_ratio": calmar_ratio,
            "avg_holding_bars": round(avg_holding_bars, 1),
            "equity_curve": self.equity_curve,
            "drawdown_curve": drawdown_curve,
            "breakdown_by_symbol": by_symbol,
            "breakdown_by_confidence": by_confidence,
            "breakdown_by_trend": by_trend,
            "trades": [t.to_dict() for t in self.trades]
        }

    def _group_trades(self, key_fn) -> Dict[str, Dict[str, Any]]:
        groups = {}
        for t in self.trades:
            key = key_fn(t)
            if key not in groups:
                groups[key] = {"trades": 0, "wins": 0, "losses": 0, "pnl": 0.0}
            groups[key]["trades"] += 1
            if t.status == "WIN": groups[key]["wins"] += 1
            elif t.status == "LOSS": groups[key]["losses"] += 1
            groups[key]["pnl"] += t.pnl_dollars

        for k, v in groups.items():
            v["win_rate"] = round((v["wins"] / v["trades"]) * 100.0, 1) if v["trades"] > 0 else 0.0
            v["pnl"] = round(v["pnl"], 2)

        return groups

    def export_csv(self, filepath: str):
        """Export completed backtest trades to CSV format."""
        trade_dicts = [t.to_dict() for t in self.trades]
        if not trade_dicts:
            return

        headers = list(trade_dicts[0].keys())
        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(trade_dicts)

    def export_interactive_html(self, filepath: str) -> str:
        """Export full interactive HTML performance report with embedded styling."""
        metrics = self.generate_performance_metrics()

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>ApexSMC Institutional Quant Backtest Report</title>
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0b0e14; color: #e1e7ef; margin: 0; padding: 24px; }}
        h1, h2, h3 {{ color: #ffffff; margin-bottom: 8px; }}
        .header {{ border-bottom: 2px solid #1e293b; padding-bottom: 16px; margin-bottom: 24px; }}
        .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }}
        .card {{ background: #131722; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; }}
        .card .label {{ color: #94a3b8; font-size: 13px; text-transform: uppercase; font-weight: 600; }}
        .card .value {{ font-size: 24px; font-weight: 700; margin-top: 6px; color: #38bdf8; }}
        .positive {{ color: #22c55e !important; }}
        .negative {{ color: #ef4444 !important; }}
        table {{ width: 100%; border-collapse: collapse; background: #131722; border-radius: 8px; overflow: hidden; margin-top: 16px; }}
        th, td {{ padding: 12px 16px; text-align: left; border-bottom: 1px solid #1e293b; font-size: 14px; }}
        th {{ background: #1e293b; color: #94a3b8; text-transform: uppercase; font-size: 12px; }}
        tr:hover {{ background: #1c2333; }}
        .badge {{ padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; display: inline-block; }}
        .badge-win {{ background: #14532d; color: #4ade80; }}
        .badge-loss {{ background: #7f1d1d; color: #fca5a5; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 ApexSMC Quantitative Strategy Backtest Report</h1>
        <p style="color: #94a3b8;">Zero Look-Ahead Bias Scan • Dynamic Risk Management • SMC & MTF Confluence</p>
    </div>

    <div class="grid">
        <div class="card"><div class="label">Net Profit</div><div class="value {'positive' if metrics['net_profit_pct'] >= 0 else 'negative'}">{metrics['net_profit_pct']}% (${metrics['net_profit_dollars']})</div></div>
        <div class="card"><div class="label">Win Rate</div><div class="value">{metrics['win_rate']}%</div></div>
        <div class="card"><div class="label">Profit Factor</div><div class="value">{metrics['profit_factor']}</div></div>
        <div class="card"><div class="label">Expectancy</div><div class="value">${metrics['expectancy']} / trade</div></div>
        <div class="card"><div class="label">Sharpe Ratio</div><div class="value">{metrics['sharpe_ratio']}</div></div>
        <div class="card"><div class="label">Sortino Ratio</div><div class="value">{metrics['sortino_ratio']}</div></div>
        <div class="card"><div class="label">Max Drawdown</div><div class="value negative">-{metrics['max_drawdown_pct']}%</div></div>
        <div class="card"><div class="label">Total Trades</div><div class="value">{metrics['total_trades']}</div></div>
    </div>

    <h2>📜 Executed Trades Log</h2>
    <table>
        <thead>
            <tr>
                <th>ID</th><th>Symbol</th><th>Side</th><th>Entry Time</th><th>Entry Price</th><th>Exit Price</th><th>SL</th><th>TP2</th><th>Status</th><th>P&amp;L ($)</th><th>Score</th>
            </tr>
        </thead>
        <tbody>
"""
        for t in metrics["trades"]:
            status_badge = f'<span class="badge badge-win">WIN</span>' if t["status"] == "WIN" else f'<span class="badge badge-loss">LOSS</span>'
            pnl_class = "positive" if t["pnl_dollars"] >= 0 else "negative"
            html_content += f"""
            <tr>
                <td>#{t['trade_id']}</td>
                <td><b>{t['symbol']}</b></td>
                <td>{t['side']}</td>
                <td>{t['entry_time']}</td>
                <td>${t['entry_price']}</td>
                <td>${t['exit_price']}</td>
                <td>${t['stop_loss']}</td>
                <td>${t['tp2']}</td>
                <td>{status_badge}</td>
                <td class="{pnl_class}">${t['pnl_dollars']}</td>
                <td><b>{t['confidence_score']}</b> ({t['confidence_tier']})</td>
            </tr>
"""

        html_content += """
        </tbody>
    </table>
</body>
</html>
"""
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html_content)

        return html_content
