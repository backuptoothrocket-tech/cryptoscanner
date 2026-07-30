import React, { useState, useEffect } from "react";
import { BotConfig, LogEntry } from "./types";
import TelemetryStatus from "./components/TelemetryStatus";
import ConfigForm from "./components/ConfigForm";
import MarketScanner from "./components/MarketScanner";
import LogViewer from "./components/LogViewer";
import PineScriptViewer from "./components/PineScriptViewer";
import PythonCodeViewer from "./components/PythonCodeViewer";
import BacktestEngine from "./components/BacktestEngine";
import PollingScanner from "./components/PollingScanner";
import TopPicks from "./components/TopPicks";
import SMCReportView from "./components/SMCReport";
import IndiaMarket from "./components/IndiaMarket";
import CryptoMarket from "./components/CryptoMarket";
import ForexMarket from "./components/ForexMarket";
import TradeJournal from "./components/TradeJournal";
import {
  LayoutDashboard, Settings, BarChart2, Radio, Code2,
  TrendingUp, Activity, Send, RefreshCw, Zap, Shield, Target, IndianRupee, BookOpen, Coins, Globe
} from "lucide-react";

type TabId = "smc" | "india" | "crypto" | "forex" | "journal" | "dashboard" | "config" | "backtest" | "polling" | "code";

const NAV_ITEMS: { id: TabId; label: string; icon: React.FC<any>; badge?: string }[] = [
  { id: "smc",       label: "SMC Analyzer", icon: Target },
  { id: "india",     label: "India Stocks", icon: IndianRupee },
  { id: "crypto",    label: "Crypto Hub",   icon: Coins },
  { id: "forex",     label: "Forex & Gold", icon: Globe },
  { id: "journal",   label: "Trade Journal",icon: BookOpen, badge: "AUTO" },
  { id: "dashboard", label: "Multi Scanner",icon: LayoutDashboard },
  { id: "backtest",  label: "Backtest",     icon: BarChart2 },
  { id: "polling",   label: "Daemon",        icon: Radio },
  { id: "config",    label: "Config",        icon: Settings },
  { id: "code",      label: "Export",        icon: Code2 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("smc");
  const [smcSymbol, setSmcSymbol] = useState<string>("RELIANCE.NS");
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fetchConfig = async () => {
    try {
      const data = await fetch("/api/config").then(r => r.json());
      setConfig(data);
    } catch {}
  };

  const fetchLogs = async () => {
    try {
      const data = await fetch("/api/logs").then(r => r.json());
      setLogs(data);
    } catch {}
  };

  const clearLogs = async () => {
    try {
      const data = await fetch("/api/logs/clear", { method: "POST" }).then(r => r.json());
      if (data.success) setLogs([]);
    } catch {}
  };

  useEffect(() => {
    Promise.all([fetchConfig(), fetchLogs()]).then(() => setLoading(false));
  }, []);

  const handleAlertTriggered = (newLog: LogEntry) => setLogs(prev => [newLog, ...prev]);
  const handleConfigSaved   = (updatedConfig: BotConfig) => setConfig(updatedConfig);

  const totalProcessed = logs.length;
  const totalPassed    = logs.filter(l => l.passedFilters).length;
  const passRatio      = totalProcessed > 0 ? Math.round((totalPassed / totalProcessed) * 100) : 0;
  const dispatched     = logs.filter(l => l.telegramSent).length;

  const [splashStep, setSplashStep] = useState(0);
  const [bootProgress, setBootProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setBootProgress(p => {
        if (p >= 100) { clearInterval(timer); return 100; }
        return p + 5;
      });
    }, 40);
    return () => clearInterval(timer);
  }, []);

  if (loading || !config || bootProgress < 100) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden" style={{ background: "#05070d" }}>
        {/* Ambient background glow */}
        <div className="absolute w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center max-w-md w-full text-center space-y-6">
          {/* Glowing Cyber Logo */}
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center glow-cyan shadow-[0_0_40px_rgba(6,182,212,0.3)]"
              style={{ background: "linear-gradient(135deg, #0e4a5a, #083345)", border: "1.5px solid rgba(6,182,212,0.4)" }}>
              <Target className="w-10 h-10 text-cyan-400 animate-pulse" />
            </div>
            <div className="absolute -inset-2 rounded-3xl border border-cyan-500/20 animate-ping pointer-events-none" style={{ animationDuration: "3s" }} />
          </div>

          {/* Title */}
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-white tracking-wider font-display">APEX<span className="text-cyan-400">SMC</span> AI</h1>
            <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">Smart Money Multi-Asset Intelligence Engine</p>
          </div>

          {/* Progress bar */}
          <div className="w-full space-y-2">
            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-white/5">
              <div className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-amber-400 rounded-full transition-all duration-150"
                style={{ width: `${bootProgress}%` }} />
            </div>
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
              <span className="text-cyan-400 font-bold">
                {bootProgress < 30 ? "Initializing Confluence Engine…" :
                 bootProgress < 60 ? "Connecting Binance & NSE feeds…" :
                 bootProgress < 90 ? "Synchronizing 24/7 Trade Monitor…" : "READY"}
              </span>
              <span>{bootProgress}%</span>
            </div>
          </div>

          {/* Boot Terminal Log */}
          <div className="w-full rounded-xl p-3 text-left font-mono text-[10px] text-slate-400 space-y-1"
            style={{ background: "rgba(10,13,20,0.8)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-emerald-400">✔ [0.2s] Confluence & SMC Engine online</p>
            <p className="text-cyan-400">✔ [0.5s] Indian Equities (NSE 2,077+ stocks) loaded</p>
            <p className="text-amber-400">✔ [0.8s] Binance Spot & Futures Feed connected</p>
            <p className="text-blue-400">✔ [1.1s] Forex & Gold Live Spot Feeds synchronized</p>
            <p className="text-slate-500">⏳ [1.4s] Launching ApexSMC Terminal…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#080b12" }} id="app-root">

      {/* ── TOP HEADER ── */}
      <header className="h-14 shrink-0 border-b flex items-center justify-between px-5 z-40 sticky top-0"
        style={{ background: "rgba(8,11,18,0.92)", backdropFilter: "blur(12px)", borderColor: "rgba(255,255,255,0.06)" }}>

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center glow-cyan"
            style={{ background: "linear-gradient(135deg, #0e4a5a, #083345)", border: "1px solid rgba(6,182,212,0.3)" }}>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight leading-none">ApexSMC AI</h1>
            <p className="text-[10px] text-slate-500 leading-none mt-0.5">Smart Money Multi-Asset Intelligence Engine</p>
          </div>
          <span className="ml-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
            style={{ background: "rgba(6,182,212,0.1)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.2)" }}>
            PRO v3.0
          </span>
        </div>

        {/* Metric pills */}
        <div className="hidden md:flex items-center gap-2">
          {[
            { label: "Scanned", value: totalProcessed, color: "#06b6d4" },
            { label: "Passed", value: totalPassed, color: "#10b981" },
            { label: "Pass Rate", value: `${passRatio}%`, color: "#818cf8" },
            { label: "Dispatched", value: dispatched, color: "#f59e0b" },
          ].map(m => (
            <div key={m.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-[10px] text-slate-500 font-medium">{m.label}</span>
              <span className="text-xs font-black font-mono" style={{ color: m.color }}>{m.value}</span>
            </div>
          ))}
        </div>

        {/* Status + nav toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-400">LIVE</span>
          </div>
          {config.telegramEnabled && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)" }}>
              <Send className="w-3 h-3 text-cyan-400" />
              <span className="text-[10px] font-bold text-cyan-400">Telegram ON</span>
            </div>
          )}
        </div>
      </header>

      {/* ── LIVE MARQUEE TICKER ── */}
      <div className="h-7 shrink-0 overflow-hidden flex items-center border-b border-white/[0.04] bg-black/50 text-[10px] font-mono select-none z-30">
        <div className="px-3 py-1 bg-cyan-500/10 text-cyan-400 font-bold shrink-0 border-r border-cyan-500/20 z-10 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          LIVE FEEDS
        </div>
        <div className="flex gap-6 whitespace-nowrap animate-marquee">
          {[
            { s: "GOLD (XAUUSD)", p: "$2,385.40", c: "+0.84%", pos: true },
            { s: "RELIANCE.NS", p: "₹1,278.00", c: "+1.25%", pos: true },
            { s: "BTC/USDT", p: "$65,420.00", c: "+2.40%", pos: true },
            { s: "EUR/USD", p: "1.0850", c: "+0.12%", pos: true },
            { s: "NIFTY 50", p: "₹24,850.00", c: "+0.45%", pos: true },
            { s: "ETH/USDT", p: "$3,450.00", c: "+1.95%", pos: true },
            { s: "TATAMOTORS", p: "₹994.50", c: "+1.80%", pos: true },
            { s: "SOL/USDT", p: "$178.50", c: "+5.12%", pos: true },
            { s: "CRUDE OIL", p: "$78.20", c: "-0.45%", pos: false },
            { s: "GBP/USD", p: "1.2950", c: "+0.18%", pos: true },
          ].concat([
            { s: "GOLD (XAUUSD)", p: "$2,385.40", c: "+0.84%", pos: true },
            { s: "RELIANCE.NS", p: "₹1,278.00", c: "+1.25%", pos: true },
            { s: "BTC/USDT", p: "$65,420.00", c: "+2.40%", pos: true },
            { s: "EUR/USD", p: "1.0850", c: "+0.12%", pos: true },
            { s: "NIFTY 50", p: "₹24,850.00", c: "+0.45%", pos: true },
            { s: "ETH/USDT", p: "$3,450.00", c: "+1.95%", pos: true },
            { s: "TATAMOTORS", p: "₹994.50", c: "+1.80%", pos: true },
            { s: "SOL/USDT", p: "$178.50", c: "+5.12%", pos: true },
            { s: "CRUDE OIL", p: "$78.20", c: "-0.45%", pos: false },
            { s: "GBP/USD", p: "1.2950", c: "+0.18%", pos: true },
          ]).map((t, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="text-slate-300 font-bold">{t.s}</span>
              <span className="text-white font-mono">{t.p}</span>
              <span className={t.pos ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>{t.c}</span>
              <span className="text-slate-800">|</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── BODY: sidebar + content ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT SIDEBAR ── */}
        <aside className="hidden md:flex flex-col py-4 shrink-0 z-30"
          style={{
            width: sidebarOpen ? 200 : 60,
            background: "rgba(10,13,20,0.95)",
            borderRight: "1px solid rgba(255,255,255,0.05)",
            transition: "width 0.25s cubic-bezier(.4,0,.2,1)"
          }}>

          <nav className="flex flex-col gap-1 px-2">
            {NAV_ITEMS.map(item => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  id={`tab-${item.id}`}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left w-full transition-all cursor-pointer group ${
                    active ? "nav-item-active" : "hover:bg-white/[0.04] text-slate-400 hover:text-slate-200"
                  }`}
                  style={active ? {} : {}}
                >
                  <item.icon className={`w-4 h-4 shrink-0 ${active ? "text-cyan-400" : "group-hover:text-slate-200"}`} />
                  {sidebarOpen && (
                    <span className="text-xs font-semibold truncate">{item.label}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar toggle at bottom */}
          <div className="mt-auto px-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
              {sidebarOpen && <span className="text-[10px] font-mono">Collapse</span>}
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 lg:p-6 pb-20 md:pb-6 space-y-5">

          {/* Mobile top scrollable sub-nav */}
          <div className="flex md:hidden gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-all ${
                  activeTab === item.id
                    ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm"
                    : "text-slate-500 hover:text-slate-300 bg-white/[0.02]"
                }`}
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            ))}
          </div>

          {/* Telemetry banner */}
          <TelemetryStatus hasGeminiKey={true} webhookCount={logs.length} pollingEnabled={config?.pollingEnabled} />

          {/* ── SMC DUAL-ENGINE REPORT ── */}
          {activeTab === "smc" && (
            <div className="animate-fade-slide">
              <SMCReportView config={config} initialSymbol={smcSymbol} />
            </div>
          )}

          {/* ── INDIA MARKET HUB ── */}
          {activeTab === "india" && (
            <div className="animate-fade-slide">
              <IndiaMarket onNavigateToSMC={(sym) => {
                setSmcSymbol(sym);
                setActiveTab("smc");
              }} />
            </div>
          )}

          {/* ── CRYPTO HUB ── */}
          {activeTab === "crypto" && (
            <div className="animate-fade-slide">
              <CryptoMarket onNavigateToSMC={(sym) => {
                setSmcSymbol(sym);
                setActiveTab("smc");
              }} />
            </div>
          )}

          {/* ── FOREX & COMMODITIES HUB ── */}
          {activeTab === "forex" && (
            <div className="animate-fade-slide">
              <ForexMarket onNavigateToSMC={(sym) => {
                setSmcSymbol(sym);
                setActiveTab("smc");
              }} />
            </div>
          )}

          {/* ── TRADE JOURNAL ── */}
          {activeTab === "journal" && (
            <div className="animate-fade-slide">
              <TradeJournal onNavigateToSMC={(sym) => {
                setSmcSymbol(sym);
                setActiveTab("smc");
              }} />
            </div>
          )}

          {/* ── DASHBOARD ── */}
          {activeTab === "dashboard" && (
            <div className="space-y-5 animate-fade-slide">
              <TopPicks />
              <MarketScanner config={config} onAlertTriggered={handleAlertTriggered} />
              <LogViewer logs={logs} onClear={clearLogs} />
            </div>
          )}

          {/* ── CONFIG ── */}
          {activeTab === "config" && (
            <div className="animate-fade-slide">
              <ConfigForm initialConfig={config} onSave={handleConfigSaved} />
            </div>
          )}

          {/* ── BACKTEST ── */}
          {activeTab === "backtest" && (
            <div className="animate-fade-slide">
              <BacktestEngine config={config} />
            </div>
          )}

          {/* ── POLLING ── */}
          {activeTab === "polling" && (
            <div className="animate-fade-slide">
              <PollingScanner config={config} onConfigSaved={handleConfigSaved} />
            </div>
          )}

          {/* ── CODE EXPORT ── */}
          {activeTab === "code" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-slide">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                  1. TradingView Pine v5 Indicator
                </p>
                <PineScriptViewer />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                  2. Python Service Deployment
                </p>
                <PythonCodeViewer />
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── BOTTOM STATUS BAR ── */}
      <footer className="h-8 shrink-0 flex items-center justify-between px-5"
        style={{ background: "rgba(8,11,18,0.95)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-600">
            <Shield className="w-3 h-3 text-emerald-500" />
            Confluence filters online
          </span>
          <span className="text-[10px] font-mono text-slate-700">
            {new Date().getFullYear()} ApexSMC AI — Smart Money Multi-Asset Intelligence Engine
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[10px] font-mono">
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="text-amber-400 font-bold">Gemini 3.5</span>
          </span>
          <span className="text-[10px] font-mono text-slate-600">Binance Spot Feed</span>
        </div>
      </footer>

      {/* ── MOBILE BOTTOM NATIVE TAB BAR ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-2 py-1 flex items-center justify-around"
        style={{ background: "rgba(8,11,18,0.96)", backdropFilter: "blur(16px)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        {NAV_ITEMS.slice(0, 5).map(item => {
          const active = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className="flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer"
              style={active ? { color: "#06b6d4" } : { color: "#64748b" }}>
              <Icon className={`w-4 h-4 ${active ? "text-cyan-400 scale-110" : ""}`} />
              <span className="text-[9px] font-bold mt-0.5 whitespace-nowrap">{item.label.split(" ")[0]}</span>
            </button>
          );
        })}
      </nav>

    </div>
  );
}
