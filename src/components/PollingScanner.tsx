import React, { useState, useEffect } from "react";
import { BotConfig } from "../types";
import { 
  Play, 
  Square, 
  CheckCircle2, 
  HelpCircle, 
  RotateCw, 
  Clock,
  ShieldCheck,
  Zap,
} from "lucide-react";

interface PollingScannerProps {
  config: BotConfig;
  onConfigSaved: (config: BotConfig) => void;
}

interface PollingLog {
  id: string;
  timestamp: string;
  symbol: string;
  price: number;
  status: "SCANNING" | "TRIGGERED" | "BLOCKED" | "AI_FILTERED";
  message: string;
  traderEvaluation?: any;
}

export default function PollingScanner({ config, onConfigSaved }: PollingScannerProps) {
  const [pollingEnabled, setPollingEnabled] = useState(config.pollingEnabled || false);
  const [intervalSecs, setIntervalSecs] = useState(config.pollingIntervalSeconds || 60);
  const [activeSymbols, setActiveSymbols] = useState<string[]>(config.activeSymbols || []);
  const [saving, setSaving] = useState(false);
  const [pollingLogs, setPollingLogs] = useState<PollingLog[]>([]);
  const [sysStats, setSysStats] = useState({
    totalScans: 0,
    alertsMatched: 0,
    lastScanTime: "Never",
    pollingCooldownUntil: 0,
  });
  const [cooldownRemaining, setCooldownRemaining] = useState<string | null>(null);

  useEffect(() => {
    const calcRemaining = () => {
      if (sysStats.pollingCooldownUntil && sysStats.pollingCooldownUntil > Date.now()) {
        const diffMs = sysStats.pollingCooldownUntil - Date.now();
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        setCooldownRemaining(`${mins}m ${secs}s`);
      } else {
        setCooldownRemaining(null);
      }
    };

    calcRemaining();
    const timer = setInterval(calcRemaining, 1000);
    return () => clearInterval(timer);
  }, [sysStats.pollingCooldownUntil]);

  useEffect(() => {
    if (config) {
      setPollingEnabled(config.pollingEnabled || false);
      setIntervalSecs(config.pollingIntervalSeconds || 60);
      setActiveSymbols(config.activeSymbols || []);
    }
  }, [config]);

  const fetchPollingLogs = async () => {
    try {
      const res = await fetch("/api/polling-logs");
      if (res.ok) {
        const data = await res.json();
        setPollingLogs(data.logs || []);
        if (data.stats) {
          setSysStats(data.stats);
        }
      }
    } catch (e) {
      console.error("Failed to fetch headless polling logs", e);
    }
  };

  useEffect(() => {
    fetchPollingLogs();
    const timer = setInterval(fetchPollingLogs, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleToggleSymbol = (symbol: string) => {
    if (activeSymbols.includes(symbol)) {
      setActiveSymbols(activeSymbols.filter(s => s !== symbol));
    } else {
      setActiveSymbols([...activeSymbols, symbol]);
    }
  };

  const handleApplyConfigs = async (overrideState?: boolean) => {
    setSaving(true);
    const targetState = overrideState !== undefined ? overrideState : pollingEnabled;
    const updatedConfig: BotConfig = {
      ...config,
      pollingEnabled: targetState,
      pollingIntervalSeconds: Number(intervalSecs),
      activeSymbols: activeSymbols,
    };

    try {
      const res = await fetch("/api/config", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(updatedConfig),
      });
      const data = await res.json();
      if (data.success) {
        onConfigSaved(data.config);
        setTimeout(fetchPollingLogs, 600);
      }
    } catch (err) {
      console.error("Failed to save polling config", err);
    } finally {
      setSaving(false);
    }
  };

  const togglePollingService = () => {
    const nextState = !pollingEnabled;
    setPollingEnabled(nextState);
    handleApplyConfigs(nextState);
  };

  const AVAILABLE_SIMULATION_PAIRS = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", 
    "ADAUSDT", "XRPUSDT", "DOGEUSDT", "LTCUSDT", 
    "AVAXUSDT", "LINKUSDT", "DOTUSDT", "NEARUSDT"
  ];

  return (
    <div className="space-y-6 font-sans animate-fade-in" id="polling-scanner-view">
      
      {/* Hero Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden shadow-lg">
        <div className="absolute right-0 top-0 w-80 h-80 bg-cyan-500/5 blur-3xl rounded-full -translate-y-12 translate-x-12 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 font-sans">
          <div className="space-y-2 max-w-2xl">
            <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-display">
              Autonomous Scanning Node
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2 font-display">
              Headless Scalp Polling Daemon
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Run an autonomous market scanner directly in the background. The server daemon queries Binance API klines on a 1H interval, calculates scalp indicators (50/200 EMA, RSI thresholds, ADX trend strengths, Stochastic RSI crossovers, and breakout structures), runs Gemini AI confluence reviews, and dispatches Alerts to your Telegram channels completely automatically!
            </p>
          </div>

          <div className="flex flex-col items-center gap-2.5 min-w-[200px]">
            <button
              onClick={togglePollingService}
              disabled={saving}
              className={`w-full py-3 px-5 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer font-display ${
                pollingEnabled
                  ? "bg-rose-500/10 hover:bg-rose-500/15 text-rose-455 border border-rose-500/30 shadow-rose-950/10"
                  : "bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 shadow-cyan-500/10"
              }`}
            >
              {pollingEnabled ? (
                <>
                  <Square className="w-4 h-4 fill-rose-400" />
                  <span>Stop Polling Daemon</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Start Polling Daemon</span>
                </>
              )}
            </button>
            <div className="flex flex-col items-center gap-1 text-center font-mono">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-455">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${pollingEnabled ? (cooldownRemaining ? "bg-amber-400" : "bg-emerald-400") : "bg-slate-650"}`} />
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${pollingEnabled ? (cooldownRemaining ? "bg-amber-500" : "bg-emerald-500") : "bg-slate-550"}`} />
                </span>
                <span>Daemon: <strong className={pollingEnabled ? (cooldownRemaining ? "text-amber-400" : "text-emerald-400") : "text-slate-500"}>{pollingEnabled ? (cooldownRemaining ? "ON COOLDOWN" : "RUNNING") : "STANDBY"}</strong></span>
              </div>
              {pollingEnabled && cooldownRemaining && (
                <div className="text-[9px] font-bold text-amber-400 bg-amber-950/50 border border-amber-500/25 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse mt-1">
                  <Clock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                  <span>Resuming in: <strong className="font-black text-white">{cooldownRemaining}</strong></span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics & Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: parameters config */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2.5 font-display">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Polling Parameters</span>
            </h2>

            {/* Interval slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                <span>Scanner Frequency</span>
                <span className="font-mono text-cyan-400 font-bold">{intervalSecs} Seconds</span>
              </div>
              <input
                type="range"
                min="10"
                max="300"
                step="10"
                value={intervalSecs}
                onChange={e => setIntervalSecs(Number(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <p className="text-[10px] text-slate-500 leading-normal">
                Frequency for the background worker to execute round-robin scalp evaluations across assets.
              </p>
            </div>

            {/* Symbols checklist */}
            <div className="space-y-2.5 pt-3 border-t border-slate-800/60">
              <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 uppercase tracking-wide font-display">
                <span>Monitored Scalp Assets ({activeSymbols.length})</span>
                <button 
                  onClick={() => setActiveSymbols(AVAILABLE_SIMULATION_PAIRS)}
                  className="text-[10px] text-cyan-400 hover:underline hover:text-cyan-300 font-medium"
                >
                  Select All
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 max-h-[160px] overflow-y-auto pr-1 border border-slate-850 p-2.5 rounded-lg bg-slate-950/40">
                {AVAILABLE_SIMULATION_PAIRS.map(sym => {
                  const isChecked = activeSymbols.includes(sym);
                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => handleToggleSymbol(sym)}
                      className={`py-1.5 px-2 rounded-lg border text-[10px] font-mono font-bold tracking-tight text-center transition-all ${
                        isChecked 
                          ? "bg-cyan-950/40 text-cyan-400 border-cyan-500/25 shadow-sm"
                          : "bg-slate-900/40 border-slate-850 text-slate-500 hover:text-slate-350 hover:border-slate-800"
                      }`}
                    >
                      {sym}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleApplyConfigs()}
              disabled={saving}
              className="w-full py-2 bg-slate-950 hover:bg-slate-850 text-cyan-400 hover:text-cyan-300 border border-cyan-500/20 hover:border-cyan-400/40 text-xs font-semibold rounded-lg active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer font-display"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Apply Polling Configurations</span>
            </button>
          </div>

          {/* Quick stats banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 grid grid-cols-2 gap-4 text-center font-sans">
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Total Scan Ticks</span>
              <span className="text-xl font-black font-mono text-cyan-400 block">{sysStats.totalScans}</span>
            </div>
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Scalp Setup Triggers</span>
              <span className="text-xl font-black font-mono text-emerald-400 block">{sysStats.alertsMatched}</span>
            </div>
            <div className="col-span-2 pt-2 border-t border-slate-850/60 text-[9px] text-slate-500 font-mono flex items-center justify-center gap-1">
              <Clock className="w-3 h-3 text-cyan-500 animate-pulse" />
              <span>Last active scan: {sysStats.lastScanTime !== "Never" ? new Date(sysStats.lastScanTime).toLocaleTimeString() : "Never"}</span>
            </div>
          </div>
        </div>

        {/* Right column: Daemon log stream */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col min-h-[400px]">
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2.5 font-display shrink-0">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Polling Log Feed</span>
          </h2>

          <div className="flex-1 overflow-y-auto max-h-[360px] space-y-2.5 mt-3.5 pr-1 font-mono text-[11px]">
            {pollingLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-650 py-12">
                <HelpCircle className="w-7 h-7 mx-auto stroke-1" />
                <h4 className="font-bold text-[10px] mt-2 font-display uppercase tracking-wider">Awaiting polling scanner activation</h4>
                <p className="text-[10px] max-w-xs mt-0.5 leading-normal">
                  Turn the Polling Service ON to start receiving background scalp trade logs.
                </p>
              </div>
            ) : (
              pollingLogs.map(log => {
                let badgeClass = "bg-slate-950 text-slate-500 border border-slate-850";
                if (log.status === "TRIGGERED") badgeClass = "bg-emerald-950/20 text-emerald-400 border border-emerald-500/10";
                if (log.status === "BLOCKED") badgeClass = "bg-rose-950/10 text-rose-455 border border-rose-500/10";

                const isSys = log.symbol === "SYS";

                return (
                  <div key={log.id} className="p-3 bg-slate-950/40 rounded-lg border border-slate-850/80 space-y-1.5 hover:border-slate-800 transition-colors">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[8px] font-black px-1.5 py-0.2 rounded font-mono ${badgeClass}`}>
                          {log.status}
                        </span>
                        {!isSys && (
                          <>
                            <strong className="text-slate-300">{log.symbol}</strong>
                            <span className="text-slate-500">@{log.price.toLocaleString()}</span>
                          </>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-600 font-medium">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className={`text-slate-350 leading-relaxed text-[10px] font-sans ${isSys ? "text-cyan-400 font-bold" : ""}`}>
                      {log.message}
                    </p>

                    {log.traderEvaluation && (
                      <div className="bg-slate-900/40 p-2.5 rounded border border-slate-850/60 flex items-start gap-2.5 mt-1">
                        <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <div className="font-sans text-[10px] leading-relaxed text-slate-400 italic">
                          "{log.traderEvaluation.humanCommentary}"
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
