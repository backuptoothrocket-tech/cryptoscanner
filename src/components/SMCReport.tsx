import React, { useState, useEffect, useCallback } from "react";
import { BotConfig, SMCDualReport, AssetClass } from "../types";
import {
  TrendingUp,
  Target,
  ShieldAlert,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Award,
  DollarSign,
  BarChart2,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Edit2,
  Check,
  X
} from "lucide-react";

interface SMCReportProps {
  config: BotConfig;
  initialSymbol?: string;
}

const PRESET_MARKETS = [
  { symbol: "RELIANCE.NS", name: "Reliance Industries", assetClass: "INDIAN_EQUITY" as const, flag: "🇮🇳" },
  { symbol: "TATAMOTORS.NS", name: "Tata Motors", assetClass: "INDIAN_EQUITY" as const, flag: "🇮🇳" },
  { symbol: "TATASTEEL.NS", name: "Tata Steel", assetClass: "INDIAN_EQUITY" as const, flag: "🇮🇳" },
  { symbol: "BHARTIARTL.NS", name: "Bharti Airtel", assetClass: "INDIAN_EQUITY" as const, flag: "🇮🇳" },
  { symbol: "ICICIBANK.NS", name: "ICICI Bank", assetClass: "INDIAN_EQUITY" as const, flag: "🇮🇳" },
  { symbol: "SBIN.NS", name: "State Bank of India", assetClass: "INDIAN_EQUITY" as const, flag: "🇮🇳" },
  { symbol: "ZOMATO.NS", name: "Zomato Ltd", assetClass: "INDIAN_EQUITY" as const, flag: "🇮🇳" },
  { symbol: "NIFTY50.NS", name: "Nifty 50 Index", assetClass: "INDIAN_EQUITY" as const, flag: "🇮🇳" },
  { symbol: "BANKNIFTY.NS", name: "Nifty Bank Index", assetClass: "INDIAN_EQUITY" as const, flag: "🇮🇳" },
  { symbol: "TCS.NS", name: "Tata Consultancy", assetClass: "INDIAN_EQUITY" as const, flag: "🇮🇳" },
  { symbol: "INFY.NS", name: "Infosys Ltd", assetClass: "INDIAN_EQUITY" as const, flag: "🇮🇳" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank", assetClass: "INDIAN_EQUITY" as const, flag: "🇮🇳" },
  { symbol: "EURUSD", name: "EUR / USD", assetClass: "FOREX" as const, flag: "🌍" },
  { symbol: "GBPUSD", name: "GBP / USD", assetClass: "FOREX" as const, flag: "🌍" },
  { symbol: "USDJPY", name: "USD / JPY", assetClass: "FOREX" as const, flag: "🌍" },
  { symbol: "XAUUSDT", name: "Gold Spot", assetClass: "FOREX" as const, flag: "🥇" },
  { symbol: "BTCUSDT", name: "Bitcoin", assetClass: "CRYPTO" as const, flag: "🪙" },
  { symbol: "ETHUSDT", name: "Ethereum", assetClass: "CRYPTO" as const, flag: "🪙" },
  { symbol: "SOLUSDT", name: "Solana", assetClass: "CRYPTO" as const, flag: "🪙" },
  { symbol: "BNBUSDT", name: "Binance Coin", assetClass: "CRYPTO" as const, flag: "🪙" },
];

function ScoreRing({ score }: { score: number }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 85 ? "#10b981" : score >= 70 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex items-center justify-center w-16 h-16 shrink-0">
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="32" cy="32" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="4" fill="transparent" />
        <circle
          cx="32"
          cy="32"
          r={r}
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={circ - fill}
          strokeLinecap="round"
          fill="transparent"
          style={{ transition: "stroke-dashoffset 0.8s ease-in-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-sm font-black font-mono leading-none" style={{ color }}>{score}</span>
        <span className="text-[8px] font-mono text-slate-500 uppercase">/100</span>
      </div>
    </div>
  );
}

export default function SMCReportView({ config, initialSymbol }: SMCReportProps) {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(initialSymbol || "RELIANCE.NS");

  useEffect(() => {
    if (initialSymbol) {
      setSelectedSymbol(initialSymbol);
    }
  }, [initialSymbol]);
  const [activeMarketTab, setActiveMarketTab] = useState<"ALL" | AssetClass>("ALL");

  // ── Dynamic Capital State ────────────────────────────────────────────────
  const [capital, setCapital]               = useState<number>(() => {
    const stored = localStorage.getItem("capital_value");
    return stored ? parseFloat(stored) : 100;
  });
  const [currency, setCurrency]             = useState<"USD" | "INR">(() => {
    return (localStorage.getItem("capital_currency") as "USD" | "INR") || "USD";
  });
  const [capitalEditing, setCapitalEditing] = useState<boolean>(false);
  const [capitalDraft,   setCapitalDraft]   = useState<string>("");

  const saveCapital = useCallback((val: number, cur: "USD" | "INR") => {
    const safe = Math.max(cur === "USD" ? 1 : 100, val);
    setCapital(safe);
    setCurrency(cur);
    localStorage.setItem("capital_value",    String(safe));
    localStorage.setItem("capital_currency", cur);
    setCapitalEditing(false);
    // Re-fetch report so position sizes recalculate with new capital
    if (selectedSymbol) fetchReport(selectedSymbol, safe, cur);
  }, [selectedSymbol]);

  const handleCurrencySwitch = (cur: "USD" | "INR") => {
    const defaultVal = cur === "USD" ? 100 : 8000;
    saveCapital(defaultVal, cur);
  };

  const [report, setReport] = useState<SMCDualReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchReport = async (sym: string, cap?: number, cur?: "USD" | "INR") => {
    setLoading(true);
    const capitalParam  = cap  ?? capital;
    const currencyParam = cur  ?? currency;
    try {
      const res = await fetch(`/api/smc-report/${sym}?capital=${capitalParam}&currency=${currencyParam}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (e) {
      console.error("Failed to fetch SMC Report", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(selectedSymbol);
    const interval = setInterval(() => fetchReport(selectedSymbol), 15000);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  const filteredMarkets = PRESET_MARKETS.filter(m => {
    const matchesTab = activeMarketTab === "ALL" || m.assetClass === activeMarketTab;
    const matchesSearch = m.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || m.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const fmtPrice = (val: number, curSym: string = "₹") => {
    if (val > 1000) return `${curSym}${val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`;
    if (val > 10) return `${curSym}${val.toFixed(2)}`;
    return `${curSym}${val.toFixed(4)}`;
  };

  return (
    <div className="space-y-5 animate-fade-slide">

      {/* ── HEADER SEARCH & MARKET BAR ── */}
      <div className="rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{ background: "rgba(10,14,22,0.9)", border: "1px solid rgba(6,182,212,0.2)" }}>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Target className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white tracking-tight">SMC Dual-Engine Analyst</h2>
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase">
                Institutional v2.5
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Intraday (MIS 5m/15m) vs Swing (CNC 1H/Daily) Quantitative Confluence
            </p>
          </div>
        </div>

        {/* Market Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
          {[
            { id: "ALL", label: "All Markets" },
            { id: "INDIAN_EQUITY", label: "🇮🇳 Indian Equities" },
            { id: "FOREX", label: "🌍 Forex & Gold" },
            { id: "CRYPTO", label: "🪙 Crypto" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveMarketTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeMarketTab === tab.id
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TICKER SELECTION SCROLLER ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {filteredMarkets.map(m => {
          const active = selectedSymbol === m.symbol;
          return (
            <button
              key={m.symbol}
              onClick={() => setSelectedSymbol(m.symbol)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer border ${
                active
                  ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300 shadow-lg shadow-cyan-950/40"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <span>{m.flag}</span>
              <span className="font-mono">{m.symbol.replace(".NS", "")}</span>
              <span className="text-[10px] text-slate-500 font-normal truncate max-w-[90px]">{m.name}</span>
            </button>
          );
        })}
      </div>

      {loading && !report ? (
        <div className="rounded-xl p-12 flex flex-col items-center justify-center gap-3 bg-slate-900/40 border border-slate-800 text-center">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-xs font-mono text-cyan-400 uppercase tracking-widest">Evaluating SMC Confluences for {selectedSymbol}...</p>
        </div>
      ) : report ? (
        <>
          {/* ── LIVE HEADER & METRICS ── */}
          <div className="rounded-xl p-5 border bg-slate-900/80 border-slate-800 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-900/50 to-slate-900 border border-cyan-500/30 flex items-center justify-center">
                  <span className="text-xl font-black text-cyan-400">
                    {report.assetClass === "INDIAN_EQUITY" ? "🇮🇳" : report.assetClass === "FOREX" ? "🌍" : "🪙"}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-black text-white tracking-tight">{report.name}</h1>
                    <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {report.symbol}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    TradingView: <span className="font-mono text-cyan-400">{report.tradingViewSymbol}</span> · {report.assetClass.replace("_", " ")}
                  </p>
                </div>
              </div>

              {/* Price Metrics */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="bg-slate-950/60 px-4 py-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Current Live Price</span>
                  <span className="text-xl font-black font-mono text-white">{fmtPrice(report.livePrice, report.currencySymbol)}</span>
                </div>

                <div className="bg-slate-950/60 px-4 py-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Session VWAP</span>
                  <span className="text-base font-bold font-mono text-cyan-400">{fmtPrice(report.vwap, report.currencySymbol)}</span>
                </div>

                <div className="bg-slate-950/60 px-4 py-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Daily Range (L - H)</span>
                  <span className="text-xs font-mono font-semibold text-slate-300">
                    {fmtPrice(report.dailyLow, report.currencySymbol)} — {fmtPrice(report.dailyHigh, report.currencySymbol)}
                  </span>
                </div>

                {/* ── Capital Widget ── */}
                <div className="bg-slate-950/80 px-3 py-2.5 rounded-xl border border-cyan-500/30 space-y-2 min-w-[170px]">
                  <span className="text-[9px] text-cyan-400 uppercase font-mono font-bold tracking-widest">Your Capital</span>

                  {/* Currency Toggle Pills */}
                  <div className="flex items-center gap-1">
                    {(["USD", "INR"] as const).map(cur => (
                      <button
                        key={cur}
                        onClick={() => handleCurrencySwitch(cur)}
                        className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase transition-all ${
                          currency === cur
                            ? "bg-cyan-500 text-black"
                            : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                        }`}
                      >
                        {cur === "USD" ? "$ USD" : "₹ INR"}
                      </button>
                    ))}
                  </div>

                  {/* Editable Amount */}
                  {capitalEditing ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono text-cyan-400">{currency === "USD" ? "$" : "₹"}</span>
                      <input
                        autoFocus
                        type="number"
                        value={capitalDraft}
                        onChange={e => setCapitalDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") saveCapital(parseFloat(capitalDraft) || capital, currency);
                          if (e.key === "Escape") setCapitalEditing(false);
                        }}
                        className="w-20 bg-slate-800 border border-cyan-500/50 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-white outline-none focus:border-cyan-400"
                      />
                      <button
                        onClick={() => saveCapital(parseFloat(capitalDraft) || capital, currency)}
                        className="p-0.5 text-emerald-400 hover:text-emerald-300"
                        title="Confirm"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setCapitalEditing(false)}
                        className="p-0.5 text-slate-500 hover:text-slate-300"
                        title="Cancel"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-1.5 group"
                      onClick={() => { setCapitalDraft(String(capital)); setCapitalEditing(true); }}
                    >
                      <span className="text-base font-black font-mono text-white group-hover:text-cyan-300 transition-colors">
                        {currency === "USD" ? "$" : "₹"}{capital.toLocaleString("en-IN")}
                      </span>
                      <Edit2 className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Overextension Warning Banner */}
            {report.isOverextended && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p className="text-xs font-medium">
                  <strong>Intraday Overextension Warning:</strong> Price is &gt;2.5x ATR away from Session VWAP. Intraday MIS setup is marked <strong>DISQUALIFIED</strong> to prevent chasing top of expansion. Evaluate Swing pullback zone for CNC entries.
                </p>
              </div>
            )}
          </div>

          {/* ── 1. DUAL-ENGINE EXECUTION ANALYSIS ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* ── OPTION A: INTRADAY SETUP (MIS) ── */}
            <div className={`rounded-xl p-5 border space-y-4 relative overflow-hidden ${
              report.intradaySetup.status === "QUALIFIED"
                ? "bg-slate-900/90 border-emerald-500/30 shadow-lg shadow-emerald-950/20"
                : "bg-slate-900/60 border-rose-500/20"
            }`}>

              {/* Card Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                      [OPTION A] INTRADAY SETUP
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      (MIS / Same-Day Exit — {report.intradaySetup.timeframe})
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-1">Intraday Scalp Confluence Engine</h3>
                </div>

                <div className="flex items-center gap-3">
                  <ScoreRing score={report.intradaySetup.score} />
                  <div className={`px-2.5 py-1 rounded-full text-xs font-black font-mono border ${
                    report.intradaySetup.status === "QUALIFIED"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  }`}>
                    {report.intradaySetup.status}
                  </div>
                </div>
              </div>

              {/* Warning for MIS Intraday */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono">
                <Clock className="w-3 h-3 shrink-0" />
                <span>INTRADAY WARNING: Auto square-off before 3:15 PM IST. Do NOT hold overnight!</span>
              </div>

              {/* Setup Details Table */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono block">Order Type</span>
                  <span className="font-mono font-bold text-white">{report.intradaySetup.orderType}</span>
                </div>

                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono block">Risk-to-Reward (Min 1:2.0)</span>
                  <span className="font-mono font-bold text-emerald-400">{report.intradaySetup.formattedRiskReward}</span>
                </div>

                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono block">Entry Zone</span>
                  <span className="font-mono font-bold text-cyan-400">
                    {fmtPrice(report.intradaySetup.entryMin, report.currencySymbol)} — {fmtPrice(report.intradaySetup.entryMax, report.currencySymbol)}
                  </span>
                </div>

                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono block">Stop Loss (Strict Invalidation)</span>
                  <span className="font-mono font-bold text-rose-400">{fmtPrice(report.intradaySetup.stopLoss, report.currencySymbol)}</span>
                </div>

                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono block">Target 1 (1st Expansion)</span>
                  <span className="font-mono font-bold text-emerald-400">{fmtPrice(report.intradaySetup.target1, report.currencySymbol)}</span>
                </div>

                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono block">Target 2 (Session Peak)</span>
                  <span className="font-mono font-bold text-emerald-300">{fmtPrice(report.intradaySetup.target2, report.currencySymbol)}</span>
                </div>
              </div>

              {/* Catalyst & Disqualification Reason */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Key Catalyst & Confluences</span>
                <p className="text-xs text-slate-300 font-mono">{report.intradaySetup.keyCatalyst}</p>
                {report.intradaySetup.disqualificationReason && (
                  <p className="text-xs text-rose-400 font-mono pt-1 border-t border-slate-800">
                    ❌ {report.intradaySetup.disqualificationReason}
                  </p>
                )}
              </div>
            </div>

            {/* ── OPTION B: SWING SETUP (CNC / DELIVERY) ── */}
            <div className={`rounded-xl p-5 border space-y-4 relative overflow-hidden ${
              report.swingSetup.status === "QUALIFIED"
                ? "bg-slate-900/90 border-cyan-500/30 shadow-lg shadow-cyan-950/20"
                : "bg-slate-900/60 border-rose-500/20"
            }`}>

              {/* Card Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase">
                      [OPTION B] SWING SETUP
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      (CNC / Delivery — {report.swingSetup.timeframe})
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-1">Multi-Day Swing Confluence Engine</h3>
                </div>

                <div className="flex items-center gap-3">
                  <ScoreRing score={report.swingSetup.score} />
                  <div className={`px-2.5 py-1 rounded-full text-xs font-black font-mono border ${
                    report.swingSetup.status === "QUALIFIED"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  }`}>
                    {report.swingSetup.status}
                  </div>
                </div>
              </div>

              {/* Holding Info */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-mono">
                <Layers className="w-3 h-3 shrink-0" />
                <span>SWING HORIZON: Delivery (CNC) holding period 1 to 5 days. Institutional Order Block retest.</span>
              </div>

              {/* Setup Details Table */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono block">Order Type</span>
                  <span className="font-mono font-bold text-white">{report.swingSetup.orderType}</span>
                </div>

                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono block">Risk-to-Reward (Min 1:2.5)</span>
                  <span className="font-mono font-bold text-cyan-400">{report.swingSetup.formattedRiskReward}</span>
                </div>

                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono block">Entry Zone</span>
                  <span className="font-mono font-bold text-cyan-400">
                    {fmtPrice(report.swingSetup.entryMin, report.currencySymbol)} — {fmtPrice(report.swingSetup.entryMax, report.currencySymbol)}
                  </span>
                </div>

                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono block">Stop Loss (Structural Level)</span>
                  <span className="font-mono font-bold text-rose-400">{fmtPrice(report.swingSetup.stopLoss, report.currencySymbol)}</span>
                </div>

                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono block">Target 1 (Liquidity Sweep)</span>
                  <span className="font-mono font-bold text-emerald-400">{fmtPrice(report.swingSetup.target1, report.currencySymbol)}</span>
                </div>

                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono block">Target 2 (Macro Swing)</span>
                  <span className="font-mono font-bold text-emerald-300">{fmtPrice(report.swingSetup.target2, report.currencySymbol)}</span>
                </div>
              </div>

              {/* Catalyst */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Key Catalyst & Confluences</span>
                <p className="text-xs text-slate-300 font-mono">{report.swingSetup.keyCatalyst}</p>
              </div>
            </div>

          </div>

          {/* ── 2. CAPITAL SIZING & RISK MANAGEMENT TABLE ── */}
          <div className="rounded-xl p-5 border bg-slate-900/80 border-slate-800 space-y-4">
              {/* Margin Safety Banner */}
              {report.capitalSizing.some((r: any) => r.marginWarning) && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium">
                    <strong>Margin Warning:</strong> One or more positions exceeds <strong>20% of your {currency === "USD" ? `$${capital}` : `₹${capital.toLocaleString("en-IN")}`} capital</strong> — risk of margin call. Consider reducing position size or increasing capital.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-cyan-400" />
                  2. Capital Sizing &amp; Risk Management Calculator
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Calculated based on your available capital of <span className="font-mono text-cyan-400">{currency === "USD" ? "$" : "₹"}{capital.toLocaleString("en-IN")}</span>
                </p>
              </div>

              <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
                Max Risk / Trade: 1–2% ({currency === "USD" ? `$${(capital * 0.01).toFixed(2)}–$${(capital * 0.02).toFixed(2)}` : `₹${(capital * 0.01).toFixed(0)}–₹${(capital * 0.02).toFixed(0)}`})
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Trade Mode</th>
                    <th className="py-2.5 px-3">Product Type</th>
                    <th className="py-2.5 px-3">Execution Entry</th>
                    <th className="py-2.5 px-3">Max Shares / Qty</th>
                    <th className="py-2.5 px-3">Capital Used</th>
                    <th className="py-2.5 px-3">Max Risk (SL)</th>
                    <th className="py-2.5 px-3">Target 1 Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {report.capitalSizing.map((row: any, idx: number) => (
                    <tr key={row.tradeMode} className={`hover:bg-slate-800/30 transition-colors ${row.marginWarning ? "ring-1 ring-inset ring-rose-500/30" : ""}`}>
                      <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${idx === 0 ? "bg-emerald-400" : "bg-cyan-400"}`} />
                        {row.tradeMode}
                        {row.marginWarning && <span className="text-[8px] font-bold text-rose-400 bg-rose-500/10 px-1 py-0.5 rounded">MARGIN ⚠</span>}
                      </td>
                      <td className="py-3 px-3 text-cyan-400 font-bold">{row.productType}</td>
                      <td className="py-3 px-3 text-slate-200">{fmtPrice(row.executionEntry, row.currencySymbol)}</td>
                      <td className="py-3 px-3 text-white font-bold">{typeof row.maxShares === 'number' && row.maxShares < 1 ? row.maxShares.toFixed(6) : row.maxShares.toLocaleString()} Units</td>
                      <td className="py-3 px-3 text-slate-300">{fmtPrice(row.capitalUsed, row.currencySymbol)}</td>
                      <td className="py-3 px-3 text-rose-400 font-bold">-{fmtPrice(row.maxRisk, row.currencySymbol)}</td>
                      <td className="py-3 px-3 text-emerald-400 font-bold">+{fmtPrice(row.target1Profit, row.currencySymbol)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 3. ZERODHA & ANGEL ONE ANALYST RECOMMENDATIONS ── */}
          <div className="rounded-xl p-5 border bg-slate-900/80 border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Zerodha & Angel One Research Call Confluence
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Live Analyst Desk Cross-Check</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.brokerConfluences.map(bc => (
                <div key={bc.broker} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded font-mono ${
                        bc.broker === "ZERODHA" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}>
                        {bc.broker === "ZERODHA" ? "ZERODHA RESEARCH" : "ANGEL ONE ARQ PRIME"}
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {bc.recommendation.callSide} ({bc.recommendation.productType})
                      </span>
                    </div>

                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      bc.alignmentStatus === "STRONG_CONFLUENCE" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}>
                      {bc.alignmentStatus}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 font-mono italic">
                    "{bc.recommendation.rationale}"
                  </p>

                  <div className="flex items-center justify-between text-[11px] font-mono pt-2 border-t border-slate-800 text-slate-400">
                    <span>Entry: {fmtPrice(bc.recommendation.entryMin, report.currencySymbol)}</span>
                    <span>SL: {fmtPrice(bc.recommendation.stopLoss, report.currencySymbol)}</span>
                    <span>Target: {fmtPrice(bc.recommendation.target1, report.currencySymbol)}</span>
                  </div>

                  <div className="p-2 rounded bg-slate-900 border border-slate-800/80 text-[10px] font-mono text-cyan-300">
                    {bc.notes}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 4. TRADINGVIEW LIVE CHART EMBED ── */}
          <div className="rounded-xl border bg-slate-900/80 border-slate-800 overflow-hidden">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
                <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
                Live TradingView Chart: {report.tradingViewSymbol}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-500">Timeframe:</span>
                {[
                  { label: "15m", val: "15" },
                  { label: "1H", val: "60" },
                  { label: "4H", val: "240" },
                  { label: "1D", val: "D" },
                ].map(tf => (
                  <button
                    key={tf.val}
                    onClick={() => {
                      const el = document.getElementById("smc-chart-iframe") as HTMLIFrameElement;
                      if (el) {
                        el.src = `https://s.tradingview.com/widgetembed/?symbol=${report.tradingViewSymbol}&interval=${tf.val}&theme=dark&style=1&timezone=exchange&hide_side_toolbar=1`;
                      }
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-700 hover:border-cyan-500/40 cursor-pointer"
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[460px] w-full relative">
              <iframe
                id="smc-chart-iframe"
                key={report.tradingViewSymbol}
                title={`${report.symbol} Chart`}
                src={`https://s.tradingview.com/widgetembed/?symbol=${report.tradingViewSymbol}&interval=60&theme=dark&style=1&timezone=exchange&hide_side_toolbar=1`}
                className="absolute inset-0 w-full h-full border-0"
                allowFullScreen
              />
            </div>
          </div>

        </>
      ) : null}

    </div>
  );
}
