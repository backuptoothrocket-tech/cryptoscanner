import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Target, ShieldAlert, RefreshCw,
  ArrowUpRight, ArrowDownRight, Zap, Clock, Star, ChevronRight
} from "lucide-react";

interface TradePlan {
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskRewardRatio: string;
}

interface Pick {
  symbol: string;
  price: number;
  score: number;
  side: "LONG" | "SHORT";
  rating: "STRONG" | "MODERATE" | "WEAK";
  reasons: string[];
  riskPct: number;
  changePercent: number;
  ema_crossover: string;
  rsi: string;
  macd: string;
  utbot: string;
  market_structure: string;
  volume: string;
  tradePlan: TradePlan;
}

function formatPrice(price: number, symbol: string): string {
  if (price > 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 1 })}`;
  if (price > 1)    return `$${price.toFixed(3)}`;
  return `$${price.toFixed(5)}`;
}

function RatingBadge({ rating }: { rating: Pick["rating"] }) {
  const styles: Record<string, React.CSSProperties> = {
    STRONG:   { background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)"  },
    MODERATE: { background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)"  },
    WEAK:     { background: "rgba(100,116,139,0.12)", color: "#94a3b8", border: "1px solid rgba(100,116,139,0.25)" },
  };
  return (
    <span className="text-[9px] font-black font-mono px-2 py-0.5 rounded-full tracking-wider" style={styles[rating]}>
      {rating}
    </span>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#64748b";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 64, height: 64 }}>
      <svg width={64} height={64} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={32} cy={32} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={4} />
        <circle cx={32} cy={32} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s ease" }} />
      </svg>
      <div className="absolute text-center">
        <span className="text-sm font-black font-mono" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

function PlanRow({ label, value, color, icon }: { label: string; value: string; color: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] text-slate-500 font-medium">{label}</span>
      </div>
      <span className="text-[11px] font-black font-mono" style={{ color }}>{value}</span>
    </div>
  );
}

export default function TopPicks() {
  const [picks, setPicks]         = useState<Pick[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [scannedAt, setScannedAt] = useState<Date | null>(null);
  const [totalScanned, setTotal]  = useState(0);
  const [countdown, setCountdown] = useState(30);

  const fetchPicks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/top-picks");
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      setPicks(data.picks || []);
      setScannedAt(new Date(data.scannedAt));
      setTotal(data.totalScanned || 0);
      setCountdown(30);
    } catch (e: any) {
      setError(e.message || "Failed to load picks");
    }
    setLoading(false);
  }, []);

  // Initial fetch + 30s auto-refresh
  useEffect(() => {
    fetchPicks();
    const interval = setInterval(fetchPicks, 30000);
    return () => clearInterval(interval);
  }, [fetchPicks]);

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 30), 1000);
    return () => clearInterval(t);
  }, [scannedAt]);

  return (
    <div className="rounded-xl overflow-hidden" id="top-picks"
      style={{ background: "rgba(10,14,22,0.9)", border: "1px solid rgba(255,255,255,0.06)" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.015)" }}>
        <div className="flex items-center gap-2.5">
          <Star className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Top Trade Picks</h3>
          <span className="text-[9px] font-mono px-2 py-0.5 rounded"
            style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>
            AI RANKED · TOP {picks.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {scannedAt && (
            <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-slate-600">
              <Clock className="w-3 h-3" />
              Refresh in {countdown}s · {totalScanned} symbols scanned
            </span>
          )}
          <button onClick={fetchPicks} disabled={loading}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-amber-400 transition-all cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5">

        {loading && picks.length === 0 && (
          <div className="py-12 flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
            <p className="text-xs font-mono text-slate-500">Scanning {totalScanned || 12} pairs for confluences...</p>
          </div>
        )}

        {error && (
          <div className="py-8 text-center">
            <p className="text-xs font-mono text-rose-400">{error}</p>
            <button onClick={fetchPicks} className="mt-3 text-[10px] text-slate-500 hover:text-white underline cursor-pointer">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && picks.length === 0 && (
          <div className="py-12 text-center">
            <ShieldAlert className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-xs font-mono text-slate-500">No high-confluence setups detected right now.</p>
            <p className="text-[10px] text-slate-700 mt-1">Market may be ranging — check back in 30s.</p>
          </div>
        )}

        {picks.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {picks.map((pick, idx) => {
              const isLong    = pick.side === "LONG";
              const sideColor = isLong ? "#10b981" : "#ef4444";
              const sideBg    = isLong ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)";
              const sideBorder = isLong ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)";
              const priceStr  = formatPrice(pick.price, pick.symbol);

              const riskAmt   = Math.abs(pick.tradePlan.entry - pick.tradePlan.stopLoss);
              const rrTP1     = (Math.abs(pick.tradePlan.takeProfit1 - pick.tradePlan.entry) / riskAmt).toFixed(1);
              const rrTP2     = (Math.abs(pick.tradePlan.takeProfit2 - pick.tradePlan.entry) / riskAmt).toFixed(1);
              const rrTP3     = (Math.abs(pick.tradePlan.takeProfit3 - pick.tradePlan.entry) / riskAmt).toFixed(1);

              return (
                <div key={pick.symbol} className="rounded-xl overflow-hidden animate-fade-slide"
                  style={{
                    background: "rgba(12,16,25,0.8)",
                    border: `1px solid ${sideBorder}`,
                    animationDelay: `${idx * 80}ms`
                  }}>

                  {/* Card header */}
                  <div className="px-4 py-3 flex items-center justify-between"
                    style={{ background: sideBg, borderBottom: `1px solid ${sideBorder}` }}>
                    <div className="flex items-center gap-2">
                      {/* Rank badge */}
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
                        style={{ background: idx === 0 ? "#f59e0b" : idx === 1 ? "#94a3b8" : "#a16207", color: "#000" }}>
                        {idx + 1}
                      </div>
                      <div>
                        <span className="text-sm font-black text-white">
                          {pick.symbol.replace("USDT","")}<span className="text-slate-600 text-xs">/USDT</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <RatingBadge rating={pick.rating} />
                      {/* Side badge */}
                      <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded"
                        style={{ background: sideBg, color: sideColor, border: `1px solid ${sideBorder}` }}>
                        {isLong
                          ? <><ArrowUpRight className="w-3 h-3" /> LONG</>
                          : <><ArrowDownRight className="w-3 h-3" /> SHORT</>}
                      </span>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-4 space-y-4">

                    {/* Score ring + price */}
                    <div className="flex items-center gap-4">
                      <ScoreRing score={pick.score} />
                      <div>
                        <p className="text-[9px] text-slate-600 font-mono uppercase mb-0.5">Entry Price</p>
                        <p className="text-xl font-black font-mono text-white">{priceStr}</p>
                        <p className={`text-[10px] font-bold font-mono flex items-center gap-0.5 ${
                          pick.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}>
                          {pick.changePercent >= 0
                            ? <ArrowUpRight className="w-3 h-3" />
                            : <ArrowDownRight className="w-3 h-3" />}
                          {pick.changePercent.toFixed(2)}% 24h
                        </p>
                      </div>
                    </div>

                    {/* Trade plan */}
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <Target className="w-3 h-3" /> Trade Plan
                      </p>

                      <PlanRow
                        label="Stop Loss"
                        value={formatPrice(pick.tradePlan.stopLoss, pick.symbol)}
                        color="#ef4444"
                        icon={<ShieldAlert className="w-3 h-3 text-rose-500" />}
                      />
                      <PlanRow
                        label={`TP1 · ${rrTP1}R`}
                        value={formatPrice(pick.tradePlan.takeProfit1, pick.symbol)}
                        color="#10b981"
                        icon={<ChevronRight className="w-3 h-3 text-emerald-500" />}
                      />
                      <PlanRow
                        label={`TP2 · ${rrTP2}R`}
                        value={formatPrice(pick.tradePlan.takeProfit2, pick.symbol)}
                        color="#10b981"
                        icon={<ChevronRight className="w-3 h-3 text-emerald-500" />}
                      />
                      <PlanRow
                        label={`TP3 · ${rrTP3}R`}
                        value={formatPrice(pick.tradePlan.takeProfit3, pick.symbol)}
                        color="#06b6d4"
                        icon={<ChevronRight className="w-3 h-3 text-cyan-400" />}
                      />
                    </div>

                    {/* Risk info */}
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                      <span className="text-[9px] text-slate-600 font-mono">SL Distance</span>
                      <span className="text-[10px] font-bold font-mono text-amber-400">{pick.riskPct}%</span>
                      <span className="text-[9px] text-slate-600 font-mono">Timeframe</span>
                      <span className="text-[10px] font-bold font-mono text-slate-300">1H Scalp</span>
                    </div>

                    {/* Reasons */}
                    {pick.reasons.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                          <Zap className="w-3 h-3 text-amber-400" /> Confluences
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {pick.reasons.map((r, i) => (
                            <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                              style={{ background: "rgba(6,182,212,0.06)", color: "#64748b", border: "1px solid rgba(6,182,212,0.1)" }}>
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card footer */}
                  <div className="px-4 py-2.5 flex items-center gap-1.5 text-[9px] font-mono text-slate-700"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    {isLong
                      ? <TrendingUp className="w-3 h-3 text-emerald-600" />
                      : <TrendingDown className="w-3 h-3 text-rose-600" />}
                    <span>Scalp setup · Score confidence: {pick.score}/100</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-4 px-4 py-3 rounded-lg text-center"
          style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <p className="text-[9px] font-mono text-slate-700 leading-relaxed">
            ⚠️ These are algorithmic suggestions based on technical confluence scoring — not financial advice.
            Always manage risk with proper position sizing. Past performance does not guarantee future results.
          </p>
        </div>
      </div>
    </div>
  );
}
