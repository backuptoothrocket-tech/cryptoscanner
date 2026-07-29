import React, { useState, useEffect } from "react";
import { BotConfig } from "../types";
import {
  Layers, Search, ArrowUpRight, ArrowDownRight, X, Clock, TrendingUp,
  ChevronUp, ChevronDown, Activity, Zap, RefreshCw
} from "lucide-react";

interface MarketScannerProps {
  config: BotConfig;
  onAlertTriggered: (newLog: any) => void;
}

function getTradingViewSymbol(symbol: string): string {
  const clean = symbol.toUpperCase().replace(".P", "");
  return clean.startsWith("XAU") ? "OANDA:XAUUSD" : `BINANCE:${clean}`;
}

const DEFAULT_PAIRS = [
  { symbol: "BTCUSDT",  price: 59500,  change: "+2.40%", volume24h: "$45.2B" },
  { symbol: "ETHUSDT",  price: 1570,   change: "+1.95%", volume24h: "$18.6B" },
  { symbol: "SOLUSDT",  price: 66.8,   change: "+5.12%", volume24h: "$4.1B"  },
  { symbol: "BNBUSDT",  price: 557,    change: "+0.85%", volume24h: "$1.4B"  },
  { symbol: "ADAUSDT",  price: 0.142,  change: "-1.15%", volume24h: "$480M"  },
  { symbol: "XRPUSDT",  price: 1.04,   change: "+11.3%", volume24h: "$8.9B"  },
  { symbol: "DOGEUSDT", price: 0.075,  change: "+4.20%", volume24h: "$2.1B"  },
  { symbol: "LTCUSDT",  price: 40.9,   change: "-0.45%", volume24h: "$340M"  },
  { symbol: "AVAXUSDT", price: 6.2,    change: "-1.20%", volume24h: "$280M"  },
  { symbol: "LINKUSDT", price: 7.26,   change: "+2.10%", volume24h: "$390M"  },
  { symbol: "DOTUSDT",  price: 0.859,  change: "-2.15%", volume24h: "$145M"  },
  { symbol: "NEARUSDT", price: 1.86,   change: "+2.10%", volume24h: "$511M"  },
];

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 70 ? "#10b981" : pct >= 45 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="score-bar"
          style={{ width: `${pct}%`, background: color, "--score-width": `${pct}%` } as React.CSSProperties}
        />
      </div>
      <span className="text-[10px] font-mono font-bold w-6 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

function Pill({ label, type }: { label: string; type: "buy"|"sell"|"hold"|"bull"|"bear"|"neutral" }) {
  return <span className={`pill pill-${type}`}>{label}</span>;
}

function getUtbotPill(val: string) {
  if (val === "buy")  return <Pill label="BUY"  type="buy"  />;
  if (val === "sell") return <Pill label="SELL" type="sell" />;
  return <Pill label="HOLD" type="hold" />;
}

function getEmaIndicator(val: string) {
  if (val === "bullish") return (
    <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold font-mono">
      <ChevronUp className="w-3 h-3" /> Bull
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-rose-400 text-[10px] font-bold font-mono">
      <ChevronDown className="w-3 h-3" /> Bear
    </span>
  );
}

function getRsiPill(val: string) {
  if (val === "oversold")   return <Pill label="OVERSOLD"   type="buy"     />;
  if (val === "overbought") return <Pill label="OVERBOUGHT" type="sell"    />;
  return                           <Pill label="NEUTRAL"    type="neutral" />;
}

function getMacdPill(val: string) {
  if (val === "bullish_cross") return <Pill label="↑ CROSS" type="buy"     />;
  if (val === "bearish_cross") return <Pill label="↓ CROSS" type="sell"    />;
  return                              <Pill label="NEUTRAL"  type="neutral" />;
}

export default function MarketScanner({ config, onAlertTriggered }: MarketScannerProps) {
  const [pairs, setPairs]               = useState(DEFAULT_PAIRS);
  const [searchQuery, setSearchQuery]   = useState("");
  const [selectedPair, setSelectedPair] = useState<any | null>(null);
  const [chartInterval, setChartInterval] = useState("240");
  const [scanIndicators, setScanIndicators] = useState<Record<string, any>>({});
  const [flash, setFlash]               = useState<Record<string, "up"|"down"|null>>({});
  const [lastRefresh, setLastRefresh]   = useState<Date | null>(null);
  const [refreshing, setRefreshing]     = useState(false);

  // Smooth price ticking
  useEffect(() => {
    const t = setInterval(() => {
      setPairs(prev => prev.map(p => {
        const delta = (Math.random() - 0.5) * p.price * 0.0012;
        if (Math.abs(delta) < 0.000001) return p;
        const dir = delta > 0 ? "up" : "down";
        const newPrice = parseFloat((p.price + delta).toFixed(p.price > 1000 ? 1 : p.price > 10 ? 3 : p.price > 1 ? 4 : 5));
        setFlash(f => ({ ...f, [p.symbol]: dir }));
        setTimeout(() => setFlash(f => ({ ...f, [p.symbol]: null })), 700);
        return { ...p, price: newPrice };
      }));
    }, 3500);
    return () => clearInterval(t);
  }, []);

  // Fetch real indicators
  const refreshIndicators = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/market-scan");
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, any> = {};
        data.forEach((item: any) => { map[item.symbol] = item; });
        setScanIndicators(map);
        setPairs(prev => data.map((item: any) => {
          const ex = prev.find(p => p.symbol === item.symbol);
          return {
            symbol: item.symbol,
            price: item.price,
            change: (item.changePercent >= 0 ? "+" : "") + (item.changePercent || 0).toFixed(2) + "%",
            volume24h: ex?.volume24h || "$500M",
          };
        }));
        setLastRefresh(new Date());
      }
    } catch {}
    setRefreshing(false);
  };

  useEffect(() => {
    refreshIndicators();
    const t = setInterval(refreshIndicators, 10000);
    return () => clearInterval(t);
  }, []);

  const getInds = (symbol: string) => scanIndicators[symbol] || {
    score: 45, volume: "normal", ema_crossover: "bullish",
    utbot: "hold", rsi: "neutral", macd: "neutral", market_structure: "", scoreBreakdown: {}
  };

  const triggerAlert = async (p: any) => {
    const inds = getInds(p.symbol);
    try {
      const res = await fetch("/api/simulate-alert", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: p.symbol, timeframe: "4H", price: p.price,
          utbot: inds.utbot === "hold" ? "buy" : inds.utbot,
          ema_crossover: inds.ema_crossover, rsi: inds.rsi,
          macd: inds.macd, market_structure: inds.market_structure || "BOS",
          volume: inds.volume,
        })
      });
      if (res.ok) onAlertTriggered(await res.json());
    } catch {}
  };

  const filtered = pairs.filter(p =>
    p.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const TIMEFRAMES = [
    { label: "1H", value: "60" },
    { label: "4H", value: "240" },
    { label: "1D", value: "D" },
    { label: "1W", value: "W" },
  ];

  return (
    <>
      {/* ── SCANNER CARD ── */}
      <div className="rounded-xl overflow-hidden" id="market-scanner"
        style={{ background: "rgba(10,14,22,0.9)", border: "1px solid rgba(255,255,255,0.06)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.015)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Active Market Pairs
            </h3>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded"
              style={{ background: "rgba(6,182,212,0.08)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.15)" }}>
              {filtered.length} SYMBOLS
            </span>
          </div>

          <div className="flex items-center gap-2">
            {lastRefresh && (
              <span className="text-[10px] font-mono text-slate-600 hidden sm:block">
                Updated {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
              </span>
            )}
            <button onClick={refreshIndicators} disabled={refreshing}
              className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-cyan-400 transition-all cursor-pointer">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-cyan-400" : ""}`} />
            </button>
            <div className="relative">
              <Search className="w-3 h-3 text-slate-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input type="text" placeholder="Search..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-7 pr-3 py-1.5 rounded-lg text-[11px] text-slate-300 outline-none transition-all w-32 focus:w-44"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {["Pair", "Price", "24h%", "Score", "UTBot", "EMA Trend", "RSI", "MACD", "Structure", ""].map(col => (
                  <th key={col} className="text-left px-4 py-2.5 text-[9px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const inds       = getInds(p.symbol);
                const flashDir   = flash[p.symbol];
                const isUp       = p.change.startsWith("+");
                const isSelected = selectedPair?.symbol === p.symbol;

                return (
                  <tr key={p.symbol}
                    onClick={() => setSelectedPair(isSelected ? null : p)}
                    className={`scanner-row ${isSelected ? "selected" : ""}`}>

                    {/* Pair */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black text-slate-400 shrink-0"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                          {p.symbol.replace("USDT","").substring(0,3)}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white block">{p.symbol.replace("USDT","")}<span className="text-slate-600">/USDT</span></span>
                          <span className="text-[9px] text-slate-600 font-mono">{p.volume24h}</span>
                        </div>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-sm font-black font-mono transition-colors duration-500 ${
                        flashDir === "up" ? "flash-up" : flashDir === "down" ? "flash-down" : "text-white"
                      }`}>
                        {p.price > 1000
                          ? `$${p.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}`
                          : p.price >= 1
                            ? `$${p.price.toFixed(3)}`
                            : `$${p.price.toFixed(5)}`}
                      </span>
                    </td>

                    {/* 24h% */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`flex items-center gap-0.5 text-xs font-bold font-mono ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                        {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {p.change}
                      </span>
                    </td>

                    {/* Score bar */}
                    <td className="px-4 py-3 min-w-[110px]">
                      <ScoreBar score={inds.score} />
                    </td>

                    {/* UTBot */}
                    <td className="px-4 py-3 whitespace-nowrap">{getUtbotPill(inds.utbot)}</td>

                    {/* EMA */}
                    <td className="px-4 py-3 whitespace-nowrap">{getEmaIndicator(inds.ema_crossover)}</td>

                    {/* RSI */}
                    <td className="px-4 py-3 whitespace-nowrap">{getRsiPill(inds.rsi)}</td>

                    {/* MACD */}
                    <td className="px-4 py-3 whitespace-nowrap">{getMacdPill(inds.macd)}</td>

                    {/* Market Structure */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {inds.market_structure ? (
                        <Pill label={inds.market_structure} type={inds.market_structure === "BOS" ? "buy" : "sell"} />
                      ) : (
                        <span className="text-[10px] font-mono text-slate-700">—</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={e => { e.stopPropagation(); triggerAlert(p); }}
                        className="text-[9px] font-bold font-mono px-2.5 py-1 rounded-lg cursor-pointer transition-all hover:scale-105"
                        style={{
                          background: "rgba(6,182,212,0.08)",
                          color: "#06b6d4",
                          border: "1px solid rgba(6,182,212,0.2)"
                        }}>
                        Simulate
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)" }}>
          <span className="text-[10px] font-mono text-slate-700">
            Binance Spot · 4H/1D candle evaluation
          </span>
          <span className="flex items-center gap-1.5 text-[9px] font-mono font-bold px-2 py-1 rounded"
            style={{ background: "rgba(6,182,212,0.06)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.12)" }}>
            <Activity className="w-2.5 h-2.5 animate-pulse" />
            STREAM ACTIVE
          </span>
        </div>
      </div>

      {/* ── PAIR DETAIL PANEL (inline, below table) ── */}
      {selectedPair && (() => {
        const inds = getInds(selectedPair.symbol);
        const confluenceItems = [
          { name: "50/200 EMA Trend",  val: inds.ema_crossover,    bull: "bullish",        labels: ["BULLISH","BEARISH"] },
          { name: "RSI Momentum",       val: inds.rsi,              bull: "oversold",       labels: ["OVERSOLD ✓","OVERBOUGHT","NEUTRAL"] },
          { name: "MACD Crossover",     val: inds.macd,             bull: "bullish_cross",  labels: ["↑ BULLISH","↓ BEARISH","NEUTRAL"] },
          { name: "UT Bot Signal",      val: inds.utbot,            bull: "buy",            labels: ["BUY ✓","SELL","HOLD"] },
          { name: "Market Structure",   val: inds.market_structure, bull: "BOS",            labels: ["BOS ✓","CHOCH","NONE"] },
          { name: "Volume Activity",    val: inds.volume,           bull: "high",           labels: ["INSTITUTIONAL ✓","NORMAL","LOW"] },
        ];

        const getBadge = (item: any) => {
          const v = item.val?.toLowerCase?.() || item.val || "";
          const isBull = v === item.bull?.toLowerCase?.() || v === item.bull;
          const isBear = v?.includes?.("sell") || v?.includes?.("bear") || v === "overbought";
          return isBull ? "buy" : isBear ? "sell" : "neutral";
        };

        const displayVal = (item: any) => {
          const v = item.val?.toUpperCase?.() || item.val || "N/A";
          if (v === "BULLISH_CROSS") return "↑ BULLISH";
          if (v === "BEARISH_CROSS") return "↓ BEARISH";
          if (v === "BULLISH") return "BULLISH ✓";
          if (v === "OVERSOLD") return "OVERSOLD ✓";
          if (v === "BOS") return "BOS ✓";
          if (v === "HIGH") return "INSTITUTIONAL ✓";
          if (v === "BUY") return "BUY ✓";
          return v || "—";
        };

        return (
          <div className="rounded-xl overflow-hidden animate-fade-slide"
            style={{ background: "rgba(10,14,22,0.9)", border: "1px solid rgba(6,182,212,0.2)" }}>

            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(6,182,212,0.04)" }}>
              <div className="flex items-center gap-3">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-black text-white">
                    {selectedPair.symbol.replace("USDT","")}<span className="text-slate-500">/USDT</span>
                    <span className="ml-2 text-[10px] font-mono text-cyan-400">Swing Desk</span>
                  </h3>
                </div>
                {/* Timeframes */}
                <div className="flex items-center gap-1 ml-2">
                  {TIMEFRAMES.map(tf => (
                    <button key={tf.value} onClick={() => setChartInterval(tf.value)}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                        chartInterval === tf.value
                          ? "text-cyan-400"
                          : "text-slate-600 hover:text-slate-300"
                      }`}
                      style={chartInterval === tf.value
                        ? { background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)" }
                        : { background: "transparent", border: "1px solid transparent" }
                      }>
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setSelectedPair(null)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-slate-600 hover:text-slate-300 transition-all cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Panel body: chart + checklist */}
            <div className="flex flex-col lg:flex-row" style={{ height: 440 }}>

              {/* TradingView chart */}
              <div className="flex-1 min-h-[260px] lg:min-h-0 relative">
                <iframe
                  key={`${selectedPair.symbol}-${chartInterval}`}
                  title={`${selectedPair.symbol} Chart`}
                  src={`https://s.tradingview.com/widgetembed/?symbol=${getTradingViewSymbol(selectedPair.symbol)}&interval=${chartInterval}&theme=dark&style=1&timezone=exchange&hide_side_toolbar=1`}
                  className="absolute inset-0 w-full h-full border-0"
                  allowFullScreen
                />
              </div>

              {/* Right panel */}
              <div className="w-full lg:w-72 flex flex-col shrink-0 overflow-y-auto"
                style={{ borderLeft: "1px solid rgba(255,255,255,0.05)" }}>

                {/* Price summary */}
                <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-1">Live Price</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black font-mono text-white">
                      {selectedPair.price > 1000
                        ? `$${selectedPair.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}`
                        : `$${selectedPair.price.toFixed(4)}`}
                    </span>
                    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                      selectedPair.change.startsWith("+") ? "text-emerald-400" : "text-rose-400"
                    }`} style={{
                      background: selectedPair.change.startsWith("+") ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                    }}>
                      {selectedPair.change}
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-[9px] text-slate-600 font-mono mb-1">Confluence Score</p>
                    <ScoreBar score={inds.score} />
                  </div>
                </div>

                {/* Confluence checklist */}
                <div className="p-4 flex-1">
                  <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-3">Signal Checklist</p>
                  <div className="space-y-1.5">
                    {confluenceItems.map(item => (
                      <div key={item.name} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                        <span className="text-[10px] text-slate-400 font-medium">{item.name}</span>
                        <Pill label={displayVal(item)} type={getBadge(item) as any} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <button onClick={() => triggerAlert(selectedPair)}
                    className="w-full py-2 rounded-lg text-xs font-bold cursor-pointer transition-all hover:scale-[1.02]"
                    style={{
                      background: "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(6,182,212,0.08))",
                      border: "1px solid rgba(6,182,212,0.3)",
                      color: "#06b6d4"
                    }}>
                    <Zap className="w-3.5 h-3.5 inline mr-1.5" />
                    Simulate Alert → Telegram
                  </button>
                  <p className="text-center text-[9px] text-slate-700 font-mono mt-2">
                    <Clock className="w-2.5 h-2.5 inline mr-1" />
                    Min score threshold: {config.confidenceThreshold}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
