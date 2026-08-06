import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Activity, Zap, Target, RefreshCw,
  IndianRupee, AlertTriangle, CheckCircle2, XCircle, Clock,
  BarChart2, Flame, Award, Shield, Radio, ChevronDown, ChevronUp,
  Layers, ArrowUpRight, Info, Send
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────

interface MarketRegime {
  nifty50Price: number;
  nifty50Change: number;
  nifty50Trend: "bullish" | "bearish" | "neutral";
  nifty50Ema20: number;
  nifty50Ema50: number;
  nifty50Ema200: number;
  bankNiftyPrice: number;
  bankNiftyChange: number;
  bankNiftyTrend: "bullish" | "bearish" | "neutral";
  vix: number;
  vixLevel: "low" | "moderate" | "high";
  adRatio: number;
  marketScore: number;
  marketOk: boolean;
  timestamp: string;
}

interface SectorScore {
  sector: string;
  score: number;
  rsScore: number;
  momentumScore: number;
  volumeScore: number;
  institutionalScore: number;
  newsScore: number;
  stockCount: number;
  avgChange: number;
  qualifies: boolean;
}

interface SwingSignal {
  symbol: string;
  name: string;
  sector: string;
  currentPrice: number;
  entryZoneLow: number;
  entryZoneHigh: number;
  stopLoss: number;
  target1: number;
  target2: number;
  holdingPeriod: string;
  confidence: number;
  totalScore: number;
  scoreBreakdown: {
    marketCondition: number;
    sectorStrength: number;
    technicalStructure: number;
    breakoutQuality: number;
    volumeConfirmation: number;
    smcConfirmation: number;
    fiidiiActivity: number;
    fundamentals: number;
    riskReward: number;
  };
  whySelected: {
    market: string;
    sector: string;
    technical: string;
    breakout: string;
    smc: string;
    volume: string;
    fiidii: string;
    fundamentals: string;
    catalyst: string;
  };
  riskReward: number;
  invalidation: string;
  aiNarrative: string;
  timestamp: string;
}

interface ScanResult {
  runAt: string;
  duration: number;
  totalScanned: number;
  sectorScores: SectorScore[];
  marketRegime: MarketRegime;
  topCandidates: { symbol: string; name: string; sector: string; score: number; price: number }[];
  signals: SwingSignal[];
  noSignalReason?: string;
}

interface MorningSignalStatus {
  symbol: string;
  name: string;
  nightlySignal: SwingSignal;
  livePrice945: number;
  gapPct: number;
  status: "CONFIRMED_IN_ZONE" | "GAP_UP_WAIT" | "GAP_DOWN_HOLD" | "INVALIDATED_BELOW_SL" | "T1_REACHED_SKIP";
  actionText: string;
}

interface MorningScanResult {
  runAt: string;
  marketRegime945: MarketRegime;
  signalStatuses: MorningSignalStatus[];
  changeOfPlan: boolean;
  changeOfPlanReason: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const fmtINR = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
const fmtIST = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit",
      day: "2-digit", month: "short", year: "2-digit",
    });
  } catch { return iso; }
};

// ── Sub-components ──────────────────────────────────────────────────────────

function ScoreRing({ score, size = 60 }: { score: number; size?: number }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const fill = Math.min(score / 100, 1) * circ;
  const color = score >= 90 ? "#10b981" : score >= 75 ? "#f59e0b" : score >= 60 ? "#f97316" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth="4" fill="transparent" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={circ - fill}
          strokeLinecap="round" fill="transparent"
          style={{ transition: "stroke-dashoffset 1s ease-in-out" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-black font-mono leading-none" style={{ color, fontSize: size < 50 ? 11 : 14 }}>{score}</span>
        <span className="text-slate-500 leading-none" style={{ fontSize: 9 }}>/100</span>
      </div>
    </div>
  );
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-slate-400 shrink-0" style={{ width: 130 }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: pct + "%", backgroundColor: color }} />
      </div>
      <span className="w-6 text-right font-mono shrink-0" style={{ color }}>{value}</span>
    </div>
  );
}

function TrendBadge({ trend }: { trend: "bullish" | "bearish" | "neutral" }) {
  if (trend === "bullish")
    return <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20"><TrendingUp className="w-3 h-3" />BULL</span>;
  if (trend === "bearish")
    return <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold text-red-400 bg-red-400/10 border border-red-400/20"><TrendingDown className="w-3 h-3" />BEAR</span>;
  return <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold text-slate-400 bg-slate-400/10 border border-slate-400/20"><Activity className="w-3 h-3" />NEUTRAL</span>;
}

function VixBadge({ level }: { level: "low" | "moderate" | "high" }) {
  if (level === "low") return <span className="px-2 py-0.5 rounded text-xs font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">LOW RISK ✅</span>;
  if (level === "moderate") return <span className="px-2 py-0.5 rounded text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20">CAUTION ⚠️</span>;
  return <span className="px-2 py-0.5 rounded text-xs font-bold text-red-400 bg-red-400/10 border border-red-400/20">HIGH VIX ❌</span>;
}

// ── Market Regime Panel ──────────────────────────────────────────────────────

function MarketRegimePanel({ regime }: { regime: MarketRegime | null }) {
  if (!regime) return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 flex items-center justify-center" style={{ minHeight: 160 }}>
      <span className="text-slate-500 text-sm">No market data yet — run a scan to populate.</span>
    </div>
  );
  const statusColor = regime.marketOk ? "#10b981" : "#ef4444";
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" /> Market Regime
        </h3>
        <span className="text-xs text-slate-500">{fmtIST(regime.timestamp)} IST</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">NIFTY 50</p>
          <p className="text-xl font-black font-mono text-white">{regime.nifty50Price.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
          <p className={`text-xs font-bold font-mono ${regime.nifty50Change >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtPct(regime.nifty50Change)}</p>
          <TrendBadge trend={regime.nifty50Trend} />
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">BANK NIFTY</p>
          <p className="text-xl font-black font-mono text-white">{regime.bankNiftyPrice.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
          <p className={`text-xs font-bold font-mono ${regime.bankNiftyChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtPct(regime.bankNiftyChange)}</p>
          <TrendBadge trend={regime.bankNiftyTrend} />
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">INDIA VIX</p>
          <p className="text-xl font-black font-mono text-white">{regime.vix.toFixed(2)}</p>
          <p className="text-xs text-slate-400 font-mono">A/D: {regime.adRatio.toFixed(2)}</p>
          <VixBadge level={regime.vixLevel} />
        </div>
      </div>

      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Nifty 50 EMA Structure</p>
        <div className="flex flex-wrap gap-4">
          {[{ label: "EMA20", val: regime.nifty50Ema20 }, { label: "EMA50", val: regime.nifty50Ema50 }, { label: "EMA200", val: regime.nifty50Ema200 }].map(({ label, val }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500">{label}:</span>
              <span className="font-mono text-slate-200 font-bold">{val > 0 ? val.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "—"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: statusColor }} />
          <span className="text-xs font-bold" style={{ color: statusColor }}>
            {regime.marketOk ? "FAVORABLE for swing entries" : "UNFAVORABLE — avoid new positions"}
          </span>
        </div>
        <span className="text-sm font-black font-mono" style={{ color: statusColor }}>
          {regime.marketScore}/10
        </span>
      </div>
    </div>
  );
}

// ── Sector Heatmap ───────────────────────────────────────────────────────────

function SectorHeatmap({ sectors }: { sectors: SectorScore[] }) {
  if (!sectors.length) return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 flex items-center justify-center" style={{ minHeight: 160 }}>
      <span className="text-slate-500 text-sm">No sector data yet.</span>
    </div>
  );
  const sorted = [...sectors].sort((a, b) => b.score - a.score);
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 space-y-3">
      <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
        <Layers className="w-4 h-4 text-violet-400" /> Sector Rotation — {sectors.length} sectors ranked
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" style={{ maxHeight: 280, overflowY: "auto" }}>
        {sorted.map(s => {
          const color = s.score >= 80 ? "#10b981" : s.score >= 60 ? "#f59e0b" : "#475569";
          return (
            <div key={s.sector} className="rounded-xl p-2.5 border"
              style={{ backgroundColor: color + "12", borderColor: color + "30" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold truncate" style={{ color }}>{s.sector}</span>
                <span className="text-xs font-black font-mono ml-1 shrink-0" style={{ color }}>{s.score}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                <span>{s.stockCount} stocks</span>
                {s.qualifies && <span className="text-emerald-400 font-bold">• ACTIVE</span>}
              </div>
              <div className="h-0.5 rounded-full mt-1.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="h-full rounded-full" style={{ width: s.score + "%", backgroundColor: color + "80" }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-600">
        🟢 Green ≥80 = eligible for signals &nbsp;·&nbsp; 🟡 Yellow 60–79 = watch &nbsp;·&nbsp; ⚫ Grey &lt;60 = avoid
      </p>
    </div>
  );
}

// ── Signal Card ──────────────────────────────────────────────────────────────

function SignalCard({ signal }: { signal: SwingSignal }) {
  const [expanded, setExpanded] = useState(false);
  const upside2 = ((signal.target2 - signal.currentPrice) / signal.currentPrice * 100).toFixed(1);
  const slRisk = ((signal.currentPrice - signal.stopLoss) / signal.currentPrice * 100).toFixed(1);

  const scoreItems: { label: string; val: number; max: number }[] = [
    { label: "Market Condition", val: signal.scoreBreakdown.marketCondition, max: 10 },
    { label: "Sector Strength", val: signal.scoreBreakdown.sectorStrength, max: 15 },
    { label: "Technical Structure", val: signal.scoreBreakdown.technicalStructure, max: 20 },
    { label: "Breakout Quality", val: signal.scoreBreakdown.breakoutQuality, max: 15 },
    { label: "Volume Confirmation", val: signal.scoreBreakdown.volumeConfirmation, max: 10 },
    { label: "SMC Confirmation", val: signal.scoreBreakdown.smcConfirmation, max: 10 },
    { label: "FII/DII Activity", val: signal.scoreBreakdown.fiidiiActivity, max: 10 },
    { label: "Fundamentals", val: signal.scoreBreakdown.fundamentals, max: 5 },
    { label: "Risk:Reward", val: signal.scoreBreakdown.riskReward, max: 5 },
  ];

  const whyItems = [
    { emoji: "📊", label: "Market", text: signal.whySelected.market },
    { emoji: "🏭", label: "Sector", text: signal.whySelected.sector },
    { emoji: "📈", label: "Technical", text: signal.whySelected.technical },
    { emoji: "🔥", label: "Breakout", text: signal.whySelected.breakout },
    { emoji: "🧠", label: "SMC", text: signal.whySelected.smc },
    { emoji: "📦", label: "Volume", text: signal.whySelected.volume },
    { emoji: "🏦", label: "FII/DII", text: signal.whySelected.fiidii },
    { emoji: "💎", label: "Fundamentals", text: signal.whySelected.fundamentals },
    { emoji: "⚡", label: "Catalyst", text: signal.whySelected.catalyst },
  ].filter(w => w.text && w.text.length > 2);

  return (
    <div className="rounded-2xl border border-emerald-400/25 overflow-hidden" style={{ background: "rgba(16,185,129,0.04)" }}>
      <div className="p-5">
        <div className="flex items-start gap-4">
          <ScoreRing score={signal.confidence} size={68} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-black text-white leading-tight">{signal.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs text-emerald-400 font-mono bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
                    {signal.symbol.replace(".NS", "")}
                  </code>
                  <span className="text-xs text-slate-500">{signal.sector}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-black font-mono text-white">{fmtINR(signal.currentPrice)}</p>
                <p className="text-xs text-emerald-400 font-bold">+{upside2}% to T2</p>
              </div>
            </div>

            {/* Price grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              {[
                { label: "Entry Zone", val: `${fmtINR(signal.entryZoneLow)}–${fmtINR(signal.entryZoneHigh)}`, color: "#06b6d4" },
                { label: "Stop Loss", val: fmtINR(signal.stopLoss), color: "#ef4444" },
                { label: "Target 1", val: fmtINR(signal.target1), color: "#10b981" },
                { label: "Target 2", val: fmtINR(signal.target2), color: "#10b981" },
              ].map(({ label, val, color }) => (
                <div key={label} className="rounded-xl p-2.5 text-center border border-white/[0.05]" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-1">{label}</p>
                  <p className="text-xs font-black font-mono leading-tight" style={{ color }}>{val}</p>
                </div>
              ))}
            </div>

            {/* Pills */}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">
                R:R 1:{signal.riskReward.toFixed(1)}
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-violet-400/10 text-violet-400 border border-violet-400/20">
                ⏱ {signal.holdingPeriod}
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-400/10 text-rose-400 border border-rose-400/20">
                SL {slRisk}% away
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20">
                Score {signal.totalScore}/100
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Expand toggle */}
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-center gap-1 py-2.5 border-t border-white/[0.05] text-xs text-slate-500 hover:text-slate-300 hover:bg-white/[0.02] transition-colors">
        {expanded
          ? <><ChevronUp className="w-3.5 h-3.5" /> Hide Full Analysis</>
          : <><ChevronDown className="w-3.5 h-3.5" /> Show Full Analysis</>}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 pb-5 space-y-5 border-t border-white/[0.04]" style={{ paddingTop: 20 }}>
          {/* Score breakdown */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Score Breakdown (100 pts)</p>
            <div className="space-y-2">
              {scoreItems.map(({ label, val, max }) => (
                <MiniBar key={label} label={`${label} (/${max})`} value={val} max={max}
                  color={val >= max * 0.8 ? "#10b981" : val >= max * 0.6 ? "#f59e0b" : "#64748b"} />
              ))}
            </div>
          </div>

          {/* Why selected */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Why Selected</p>
            <div className="space-y-2">
              {whyItems.map(({ emoji, label, text }) => (
                <div key={label} className="flex gap-2.5 text-xs">
                  <span className="shrink-0">{emoji} <span className="text-slate-400 font-semibold">{label}:</span></span>
                  <span className="text-slate-300 leading-relaxed">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Narrative */}
          {signal.aiNarrative && (
            <div className="rounded-xl p-4 border border-violet-500/20" style={{ background: "rgba(139,92,246,0.06)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-2">🤖 AI Research Analysis</p>
              <p className="text-xs text-slate-300 leading-relaxed">{signal.aiNarrative}</p>
            </div>
          )}

          {/* Invalidation */}
          <div className="flex items-start gap-3 rounded-xl p-3 border border-red-500/20" style={{ background: "rgba(239,68,68,0.05)" }}>
            <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Trade Invalidation</p>
              <p className="text-xs text-slate-300 mt-0.5">{signal.invalidation}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Top Candidates Table ─────────────────────────────────────────────────────

function TopCandidatesTable({ candidates }: { candidates: { symbol: string; name: string; sector: string; score: number; price: number }[] }) {
  if (!candidates.length) return null;
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 space-y-3">
      <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
        <Award className="w-4 h-4 text-amber-400" /> Top Scored Candidates (pre-signal filter)
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["#", "Symbol", "Name", "Sector", "Score", "Price"].map(h => (
                <th key={h} className="pb-2 pr-4 text-left font-bold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {candidates.slice(0, 10).map((c, i) => {
              const color = c.score >= 90 ? "#10b981" : c.score >= 80 ? "#f59e0b" : "#64748b";
              return (
                <tr key={c.symbol} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 pr-4 text-slate-600 font-mono">{i + 1}</td>
                  <td className="py-2.5 pr-4 font-mono font-bold text-cyan-400">{c.symbol.replace(".NS", "")}</td>
                  <td className="py-2.5 pr-4 text-slate-300 max-w-[140px] truncate">{c.name}</td>
                  <td className="py-2.5 pr-4 text-slate-500">{c.sector}</td>
                  <td className="py-2.5 pr-4">
                    <span className="font-black font-mono" style={{ color }}>{c.score}</span>
                    {c.score >= 90 && <span className="ml-1.5 text-[9px] text-emerald-400 font-bold">A+</span>}
                  </td>
                  <td className="py-2.5 font-mono text-slate-300">{fmtINR(c.price)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Scan History ─────────────────────────────────────────────────────────────

function ScanHistoryPanel({ history }: { history: { runAt: string; signals: number; scanned: number }[] }) {
  if (!history.length) return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 flex items-center justify-center" style={{ minHeight: 120 }}>
      <span className="text-slate-500 text-sm">No scan history yet.</span>
    </div>
  );
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 space-y-3">
      <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
        <Clock className="w-4 h-4 text-slate-400" /> Scan History (last {Math.min(history.length, 30)} runs)
      </h3>
      <div className="space-y-1.5">
        {history.slice(0, 14).map((h, i) => (
          <div key={i} className="flex items-center justify-between text-xs rounded-xl px-4 py-2.5 border border-white/[0.04]"
            style={{ background: "rgba(255,255,255,0.02)" }}>
            <span className="text-slate-400 font-mono">{fmtIST(h.runAt)}</span>
            <span className="text-slate-600">{h.scanned.toLocaleString()} stocks</span>
            <span className={`font-bold ${h.signals > 0 ? "text-emerald-400" : "text-slate-600"}`}>
              {h.signals > 0 ? `🔥 ${h.signals} signal${h.signals > 1 ? "s" : ""}` : "No signals"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function NSESwingDashboard() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [marketRegime, setMarketRegime] = useState<MarketRegime | null>(null);
  const [sectorScores, setSectorScores] = useState<SectorScore[]>([]);
  const [history, setHistory] = useState<{ runAt: string; signals: number; scanned: number }[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [nextScanIn, setNextScanIn] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"signals" | "sectors" | "history">("signals");
  const [pollTimer, setPollTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const [morningResult, setMorningResult] = useState<MorningScanResult | null>(null);
  const [runningMorningScan, setRunningMorningScan] = useState(false);

  const fetchLastResult = useCallback(async () => {
    try {
      const r = await fetch("/api/nse-swing/last-result");
      if (!r.ok) return;
      const d = await r.json();
      if (d.result) {
        setScanResult(d.result);
        if (d.result.marketRegime) setMarketRegime(d.result.marketRegime);
        if (d.result.sectorScores?.length) setSectorScores(d.result.sectorScores);
        setLastScanTime(d.result.runAt);
      }
      if (d.morningResult) setMorningResult(d.morningResult);
      if (Array.isArray(d.history)) setHistory(d.history);
    } catch {}
  }, []);

  const fetchMarketRegime = useCallback(async () => {
    try {
      const r = await fetch("/api/nse-swing/market-regime");
      if (!r.ok) return;
      const d = await r.json();
      if (d.regime) setMarketRegime(d.regime);
    } catch {}
  }, []);

  const fetchSectorScores = useCallback(async () => {
    try {
      const r = await fetch("/api/nse-swing/sector-scores");
      if (!r.ok) return;
      const d = await r.json();
      if (Array.isArray(d.sectors)) setSectorScores(d.sectors);
    } catch {}
  }, []);

  useEffect(() => {
    fetchLastResult();
    fetchMarketRegime();
    const id = setInterval(fetchMarketRegime, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchLastResult, fetchMarketRegime]);

  // Countdown to next 12:00 AM IST
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const istNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const nextMidnight = new Date(istNow);
      if (istNow.getHours() >= 0) nextMidnight.setDate(nextMidnight.getDate() + 1);
      nextMidnight.setHours(0, 0, 0, 0);
      const diffMs = nextMidnight.getTime() - istNow.getTime();
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      setNextScanIn(`${h}h ${m}m`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  const runScan = async () => {
    setScanning(true);
    setScanError(null);
    try {
      const r = await fetch("/api/nse-swing/run-scan", { method: "POST" });
      const d = await r.json();
      if (d.result) {
        setScanResult(d.result);
        if (d.result.marketRegime) setMarketRegime(d.result.marketRegime);
        if (d.result.sectorScores?.length) setSectorScores(d.result.sectorScores);
        setLastScanTime(d.result.runAt);
        await fetchLastResult();
      } else if (d.error) {
        setScanError(d.error);
      }
    } catch (e: any) {
      setScanError(e?.message || "Scan failed — check server logs");
    } finally {
      setScanning(false);
    }
  };

  const runMorningScan = async () => {
    setRunningMorningScan(true);
    try {
      const r = await fetch("/api/nse-swing/run-morning-scan", { method: "POST" });
      const d = await r.json();
      if (d.result) {
        setMorningResult(d.result);
      }
    } catch (e: any) {
      setScanError(e?.message || "Morning scan failed");
    } finally {
      setRunningMorningScan(false);
    }
  };

  const signals = scanResult?.signals || [];
  const noSignalReason = scanResult?.noSignalReason;
  const totalScanned = scanResult?.totalScanned || 0;

  return (
    <div style={{ minHeight: "100vh", background: "#080810", overflowY: "auto" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px 48px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* ─── Header ─────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #10b981, #06b6d4)" }}>
                  <IndianRupee className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-black text-white">NSE Swing Research Engine</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest border"
                  style={{ color: "#10b981", background: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.2)" }}>
                  TOP 3 SWING + 9:45 AM LIVE SCAN
                </span>
              </div>
              <p className="text-sm text-slate-500">
                Nightly 12:00 AM IST Top 3 Picks · Morning 9:45 AM Strategy & Change of Plan Telegram Scan
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <button id="nse-swing-morning-btn" onClick={runMorningScan} disabled={runningMorningScan}
                  className="flex items-center gap-2 rounded-xl font-bold text-xs transition-all"
                  style={{
                    padding: "9px 16px",
                    background: "rgba(245,158,11,0.1)",
                    color: "#f59e0b",
                    border: "1px solid rgba(245,158,11,0.3)",
                    cursor: runningMorningScan ? "not-allowed" : "pointer",
                  }}>
                  {runningMorningScan ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                  Run 9:45 AM Morning Scan
                </button>
                <button id="nse-swing-scan-btn" onClick={runScan} disabled={scanning}
                  className="flex items-center gap-2 rounded-xl font-bold text-sm transition-all"
                  style={{
                    padding: "10px 22px",
                    background: scanning ? "rgba(16,185,129,0.1)" : "linear-gradient(135deg, #10b981, #06b6d4)",
                    color: scanning ? "#10b981" : "#fff",
                    border: "1px solid rgba(16,185,129,0.3)",
                    cursor: scanning ? "not-allowed" : "pointer",
                  }}>
                  {scanning
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Scanning NSE…</>
                    : <><Zap className="w-4 h-4" /> Run 12 AM Nightly Scan</>}
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                {lastScanTime && <span>Last Nightly: {fmtIST(lastScanTime)}</span>}
                {nextScanIn && <span>Next: <span style={{ color: "#10b981", fontWeight: 700 }}>{nextScanIn}</span></span>}
              </div>
            </div>
          </div>

          {/* ─── Error ──────────────────────────────────────────────────── */}
          {scanError && (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 border border-red-500/20"
              style={{ background: "rgba(239,68,68,0.08)" }}>
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-sm text-red-300">{scanError}</span>
            </div>
          )}

          {/* ─── Stats bar ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Stocks Scanned", val: totalScanned > 0 ? totalScanned.toLocaleString() : "—", icon: <BarChart2 className="w-4 h-4" />, color: "#06b6d4" },
              { label: "Sectors Ranked", val: sectorScores.length > 0 ? sectorScores.length : "—", icon: <Layers className="w-4 h-4" />, color: "#8b5cf6" },
              { label: "Active Sectors", val: sectorScores.filter(s => s.qualifies).length || "—", icon: <CheckCircle2 className="w-4 h-4" />, color: "#10b981" },
              { label: "A-Grade Signals", val: signals.length || "0", icon: <Flame className="w-4 h-4" />, color: signals.length > 0 ? "#10b981" : "#475569" },
            ].map(({ label, val, icon, color }) => (
              <div key={label} className="rounded-2xl border border-white/[0.06] p-4 flex items-center gap-3"
                style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: color + "15", color }}>
                  {icon}
                </div>
                <div>
                  <p className="text-2xl font-black font-mono" style={{ color }}>{val}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ─── Market Regime ──────────────────────────────────────────── */}
          <MarketRegimePanel regime={marketRegime} />

          {/* ─── Tabs ───────────────────────────────────────────────────── */}
          <div className="flex gap-1 p-1 rounded-xl border border-white/[0.06] w-fit"
            style={{ background: "rgba(255,255,255,0.02)" }}>
            {([
              { id: "signals" as const, label: `🔥 Signals${signals.length > 0 ? ` (${signals.length})` : ""}` },
              { id: "sectors" as const, label: `📊 Sectors${sectorScores.length > 0 ? ` (${sectorScores.length})` : ""}` },
              { id: "history" as const, label: "🕐 History" },
            ]).map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: activeTab === tab.id ? "rgba(255,255,255,0.08)" : "transparent",
                  color: activeTab === tab.id ? "#fff" : "#64748b",
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ─── Signals Tab ─────────────────────────────────────────────── */}
          {activeTab === "signals" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* 🌅 9:45 AM Morning Scan Banner */}
              {morningResult && (
                <div className="rounded-2xl p-4 border border-amber-500/30" style={{ background: "rgba(245,158,11,0.06)" }}>
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <h4 className="text-sm font-bold text-amber-400">🌅 9:45 AM Morning Strategy & Change of Plan Status</h4>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">Run: {fmtIST(morningResult.runAt)}</span>
                  </div>

                  {morningResult.changeOfPlan && (
                    <div className="flex items-center gap-2 text-xs font-bold text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20 mb-3">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{morningResult.changeOfPlanReason}</span>
                    </div>
                  )}

                  {morningResult.signalStatuses.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {morningResult.signalStatuses.map(s => {
                        const isGood = s.status === "CONFIRMED_IN_ZONE";
                        const isWait = s.status === "GAP_UP_WAIT";
                        const isBad  = s.status === "INVALIDATED_BELOW_SL" || s.status === "T1_REACHED_SKIP";
                        const color  = isGood ? "#10b981" : isWait ? "#f59e0b" : isBad ? "#ef4444" : "#94a3b8";
                        return (
                          <div key={s.symbol} className="flex items-center justify-between text-xs rounded-xl p-3 border border-white/[0.04]"
                            style={{ background: "rgba(255,255,255,0.02)" }}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-bold text-white truncate">{s.name}</span>
                              <code className="text-[10px] text-cyan-400 font-mono">{s.symbol.replace(".NS", "")}</code>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              <span className="font-mono text-slate-300">Live 9:45 AM: {fmtINR(s.livePrice945)}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold border"
                                style={{ color, backgroundColor: color + "15", borderColor: color + "30" }}>
                                {s.status.replace(/_/g, " ")}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {signals.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.06] p-12 text-center"
                  style={{ background: "rgba(255,255,255,0.02)" }}>
                  {scanning ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                      <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
                      <div>
                        <p className="text-white font-bold text-lg">Scanning NSE Universe…</p>
                        <p className="text-slate-500 text-sm mt-1">Collecting data · Running analysis · Scoring stocks · Generating AI narratives</p>
                      </div>
                    </div>
                  ) : noSignalReason ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                      <Shield className="w-10 h-10 text-amber-400" />
                      <p className="text-amber-400 font-bold text-lg">No A-Grade NSE Swing Setup Today</p>
                      <p className="text-slate-500 text-sm" style={{ maxWidth: 400 }}>{noSignalReason}</p>
                      <p className="text-slate-600 text-xs">No signal is better than a bad signal. The engine only alerts at ≥90/100 confidence.</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                      <Zap className="w-10 h-10 text-slate-600" />
                      <p className="text-slate-400 font-bold">No scan run yet</p>
                      <p className="text-slate-500 text-sm">Click "Run Scan Now" or wait for the nightly 12:00 AM IST auto-scan</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 rounded-xl px-4 py-3 border border-emerald-500/20"
                    style={{ background: "rgba(16,185,129,0.06)" }}>
                    <Flame className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-400">
                      {signals.length} A-Grade Signal{signals.length > 1 ? "s" : ""} · Confidence ≥90/100 · Telegram alert dispatched
                    </span>
                  </div>
                  {signals.map(s => <SignalCard key={s.symbol} signal={s} />)}
                </>
              )}
              {(scanResult?.topCandidates?.length ?? 0) > 0 && (
                <TopCandidatesTable candidates={scanResult!.topCandidates} />
              )}
            </div>
          )}

          {/* ─── Sectors Tab ─────────────────────────────────────────────── */}
          {activeTab === "sectors" && <SectorHeatmap sectors={sectorScores} />}

          {/* ─── History Tab ─────────────────────────────────────────────── */}
          {activeTab === "history" && <ScanHistoryPanel history={history} />}

          {/* ─── Footer ──────────────────────────────────────────────────── */}
          <div className="rounded-xl px-4 py-3 text-center border border-white/[0.04]"
            style={{ background: "rgba(255,255,255,0.01)" }}>
            <p className="text-[11px] text-slate-600">
              🤖 NSE Institutional Swing Research Engine · Delivery swing trades only · 3–15 day hold ·
              Max 3 signals/night · Sources: NSE Official · Yahoo Finance · Screener.in · Moneycontrol RSS · ET RSS · CNBCTV18 RSS
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
