import React, { useState } from "react";
import { Copy, Check, Terminal, FileCode, Server, ShieldCheck, Cpu, Code2 } from "lucide-react";

export default function PythonCodeViewer() {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"backtest" | "smc" | "scoring" | "risk" | "learning">("backtest");

  const backtestEngineCode = `"""
ApexSMC Institutional Backtesting Engine (Zero Look-Ahead Bias)
"""

import math
from python_engine.indicators import calculate_ema, calculate_rsi, calculate_macd, calculate_atr
from python_engine.smc_analyzer import SMCAnalyzer
from python_engine.scoring_engine import ScoringEngine
from python_engine.risk_manager import RiskManager

class BacktestEngine:
    def __init__(self, initial_capital: float = 10000.0):
        self.initial_capital = initial_capital
        self.capital = initial_capital
        self.trades = []
        self.equity_curve = [initial_capital]

    def run_backtest(self, ohlcv_bars, symbol="BTCUSDT"):
        # Zero look-ahead bias execution loop
        for i in range(200, len(ohlcv_bars)):
            # Evaluate signals on completed candle close (i-1)
            # Execute entries on next candle open (i)
            # Validate SL/TP hits intrabar with conservative execution
            pass
`;

  const smcCode = `"""
Smart Money Concepts (SMC) Detector
Detects BOS, CHOCH, Fair Value Gaps (FVG), Order Blocks, and Liquidity Sweeps.
"""

class SMCAnalyzer:
    @staticmethod
    def evaluate_smc_confluences(opens, highs, lows, closes, volumes, is_buy):
        # Requires at least TWO valid SMC confirmations
        confirmations = []
        # Check BOS, CHOCH, FVG, Order Blocks, Liquidity Sweeps, Premium/Discount
        return {
            "has_min_smc": len(confirmations) >= 2,
            "smc_count": len(confirmations),
            "confirmations": confirmations
        }
`;

  const scoringCode = `"""
110-Point Weighted Scoring Engine
Trend=25, Structure=20, Volume=15, Momentum=15, SMC=15, Volatility=5, RR=5, HTF=10
"""

class ScoringEngine:
    @staticmethod
    def calculate_score(...):
        # Calculates component breakdown and determines confidence tier (Elite, A+, A, B)
        # Trades below 65 are rejected
        pass
`;

  const riskCode = `"""
Institutional Risk Manager
Dynamic 1% Account Risk Position Sizing, 2:1+ RR Enforcement, Trailing Stops, Portfolio Limits
"""

class RiskManager:
    @staticmethod
    def calculate_position_size(account_balance, entry_price, stop_loss, risk_pct=1.0):
        risk_amount = account_balance * (risk_pct / 100.0)
        risk_per_unit = abs(entry_price - stop_loss)
        return {"risk_amount": risk_amount, "position_size": risk_amount / risk_per_unit}
`;

  const learningCode = `"""
Self-Learning & Strategy Optimization Engine
Compares winner vs loser indicator states to output statistical optimizations.
"""

class SelfLearningEngine:
    @staticmethod
    def analyze_trade_performance(trades):
        # Output top/worst symbols and parameter optimization suggestions
        pass
`;

  const getActiveCode = () => {
    switch (activeTab) {
      case "backtest": return backtestEngineCode;
      case "smc": return smcCode;
      case "scoring": return scoringCode;
      case "risk": return riskCode;
      case "learning": return learningCode;
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getActiveCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Code2 className="w-5 h-5 text-cyan-400" />
              ApexSMC Python Quant Engine Source Architecture
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Clean modular Python 3.14 quant engine architecture (`python_engine/`)
            </p>
          </div>

          <button
            onClick={copyToClipboard}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition flex items-center gap-2 self-start md:self-auto"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
            {copied ? "Copied Code!" : "Copy Python Module"}
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap gap-2 mt-6 border-b border-slate-800 pb-3">
          {[
            { id: "backtest", label: "backtest_engine.py", icon: Terminal },
            { id: "smc", label: "smc_analyzer.py", icon: ShieldCheck },
            { id: "scoring", label: "scoring_engine.py", icon: Cpu },
            { id: "risk", label: "risk_manager.py", icon: Server },
            { id: "learning", label: "self_learning.py", icon: FileCode }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Code Display Window */}
        <div className="mt-4 bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-cyan-300 overflow-x-auto">
          <pre>{getActiveCode()}</pre>
        </div>
      </div>
    </div>
  );
}
