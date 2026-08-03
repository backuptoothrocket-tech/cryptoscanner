"""
ApexSMC Quant CLI Runner
Command-line tool to run zero look-ahead backtests, parameter optimization, and generate reports.
"""

import sys
import os
import json
import argparse

from python_engine.backtest_engine import BacktestEngine, TradeRecord
from python_engine.self_learning import SelfLearningEngine
from python_engine.config import MIN_CONFIDENCE_SCORE

def generate_sample_bars(count: int = 300) -> list:
    """Generate realistic synthetic OHLCV candle data for demonstration."""
    import random
    bars = []
    base_price = 60000.0
    price = base_price
    
    for i in range(count):
        change = (random.random() - 0.48) * 400.0  # slight upward drift
        price += change
        high = price + random.random() * 200.0
        low = price - random.random() * 200.0
        open_price = price - (change * 0.5)
        close_price = price
        volume = 1000.0 + random.random() * 1500.0
        
        bars.append({
            "timestamp": f"2026-06-01 {i % 24:02d}:00",
            "open": round(open_price, 2),
            "high": round(high, 2),
            "low": round(low, 2),
            "close": round(close_price, 2),
            "volume": round(volume, 2)
        })
        
    return bars


def main():
    parser = argparse.ArgumentParser(description="ApexSMC Institutional Quant Engine CLI")
    parser.add_argument("--mode", choices=["backtest", "self-learning", "report"], default="backtest", help="Execution mode")
    parser.add_argument("--symbol", default="BTCUSDT", help="Trading symbol")
    parser.add_argument("--output", default="backtest_report.html", help="HTML report output path")
    args = parser.parse_args()

    print(f"=== ApexSMC Quant Engine v2.0.0 ===")
    print(f"Executing Mode: {args.mode.upper()} | Symbol: {args.symbol}")

    bars = generate_sample_bars(350)
    engine = BacktestEngine(initial_capital=10000.0)
    results = engine.run_backtest(bars, symbol=args.symbol)

    print("\n--- Backtest Performance Results ---")
    print(f"Initial Capital:  ${results['initial_capital']}")
    print(f"Final Capital:    ${results['final_capital']} ({results['net_profit_pct']}%)")
    print(f"Win Rate:         {results['win_rate']}% ({results['wins']} W / {results['losses']} L)")
    print(f"Profit Factor:    {results['profit_factor']}")
    print(f"Expectancy:       ${results['expectancy']} / trade")
    print(f"Sharpe Ratio:     {results['sharpe_ratio']}")
    print(f"Max Drawdown:     -{results['max_drawdown_pct']}%")

    if args.mode in ["backtest", "report"]:
        out_path = args.output
        engine.export_interactive_html(out_path)
        print(f"\n✅ Interactive HTML Report generated at: {os.path.abspath(out_path)}")

    if args.mode == "self-learning":
        print("\n--- Self-Learning Strategy Analytics ---")
        learning_res = SelfLearningEngine.analyze_trade_performance(results["trades"])
        print(json.dumps(learning_res, indent=2))

if __name__ == "__main__":
    main()
