import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  PlusCircle, Trash2, RefreshCw,
  Target, Clock, CheckCircle2, XCircle, AlertTriangle,
  Activity, BarChart2, Download, ChevronDown, ChevronUp
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Side = "LONG" | "SHORT";
type Market = "INDIAN_EQUITY" | "CRYPTO" | "FOREX";
type TradeStatus = "HOLDING" | "SL_HIT" | "TP1_HIT" | "TP2_HIT" | "BREAKEVEN" | "PENDING";

interface Trade {
  id: string;
  symbol: string;
  market: Market;
  side: Side;
  entryPrice: number;
  quantity: number;
  sl: number;
  tp1: number;
  tp2: number;
  entryDate: string;
  notes: string;
  currentPrice?: number;
  status?: TradeStatus;
  pnl?: number;
  pnlPct?: number;
  lastUpdated?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const LS_KEY = "cryptoscanner_trades_v1";

function saveTrades(trades: Trade[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(trades)); } catch {}
}
function loadTrades(): Trade[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function uid() { return Math.random().toString(36).slice(2, 10); }

function fmtCur(market: Market, n: number) {
  const sym = market === "INDIAN_EQUITY" ? "₹" : "$";
  return sym + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function computeStatus(t: Trade, cur: number): TradeStatus {
  if (!cur) return "PENDING";
  if (t.side === "LONG") {
    if (cur <= t.sl) return "SL_HIT";
    if (t.tp2 && cur >= t.tp2) return "TP2_HIT";
    if (cur >= t.tp1) return "TP1_HIT";
    if (Math.abs(cur - t.entryPrice) / t.entryPrice < 0.001) return "BREAKEVEN";
    return "HOLDING";
  } else {
    if (cur >= t.sl) return "SL_HIT";
    if (t.tp2 && cur <= t.tp2) return "TP2_HIT";
    if (cur <= t.tp1) return "TP1_HIT";
    if (Math.abs(cur - t.entryPrice) / t.entryPrice < 0.001) return "BREAKEVEN";
    return "HOLDING";
  }
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: TradeStatus }) {
  const cfg: Record<TradeStatus, { label: string; color: string; bg: string }> = {
    HOLDING:   { label: "⏳ HOLDING",   color: "#06b6d4", bg: "rgba(6,182,212,0.1)" },
    SL_HIT:    { label: "❌ SL HIT",   color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
    TP1_HIT:   { label: "✅ TP1 HIT",  color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    TP2_HIT:   { label: "🎯 TP2 HIT",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
    BREAKEVEN: { label: "⚖️ BREAKEVEN",color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
    PENDING:   { label: "🔄 PENDING",  color: "#64748b", bg: "rgba(100,116,139,0.08)" },
  };
  const c = cfg[status];
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}40` }}
    >
      {c.label}
    </span>
  );
}

// ─── Add Trade Form ────────────────────────────────────────────────────────────
function AddTradeForm({ onAdd, onClose }: { onAdd: (t: Trade) => void; onClose: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [market, setMarket] = useState<Market>("INDIAN_EQUITY");
  const [side, setSide] = useState<Side>("LONG");
  const [entryPrice, setEntryPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [sl, setSl] = useState("");
  const [tp1, setTp1] = useState("");
  const [tp2, setTp2] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");

  const inputCls = "w-full px-3 py-2 rounded-lg text-xs text-white outline-none placeholder-slate-600 focus:ring-1 focus:ring-cyan-500/40";
  const inputStyle = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" };
  const label = (txt: string) => (
    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">{txt}</label>
  );

  const submit = () => {
    if (!symbol || !entryPrice || !quantity || !sl || !tp1) {
      setErr("Symbol, Entry Price, Qty, SL and TP1 are required."); return;
    }
    const t: Trade = {
      id: uid(),
      symbol: symbol.toUpperCase().trim(),
      market, side,
      entryPrice: parseFloat(entryPrice),
      quantity: parseFloat(quantity),
      sl: parseFloat(sl),
      tp1: parseFloat(tp1),
      tp2: tp2 ? parseFloat(tp2) : 0,
      entryDate: new Date().toISOString(),
      notes,
    };
    onAdd(t);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: "#0d1117", border: "1px solid rgba(6,182,212,0.25)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <span className="text-base">📝</span> Add New Trade
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xs cursor-pointer">✕ Close</button>
        </div>
        {err && <p className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded-lg">{err}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            {label("Symbol")}
            <input
              className={inputCls} style={inputStyle}
              placeholder="e.g. RELIANCE, BTCUSDT, EURUSD"
              value={symbol} onChange={e => setSymbol(e.target.value)}
            />
          </div>
          <div>
            {label("Market")}
            <select className={inputCls} style={inputStyle} value={market} onChange={e => setMarket(e.target.value as Market)}>
              <option value="INDIAN_EQUITY">🇮🇳 Indian Equity (NSE)</option>
              <option value="CRYPTO">🪙 Crypto (Binance)</option>
              <option value="FOREX">🌍 Forex / Gold</option>
            </select>
          </div>
          <div>
            {label("Side / Direction")}
            <select className={inputCls} style={inputStyle} value={side} onChange={e => setSide(e.target.value as Side)}>
              <option value="LONG">📈 LONG (Buy)</option>
              <option value="SHORT">📉 SHORT (Sell)</option>
            </select>
          </div>
          <div>
            {label("Entry Price")}
            <input type="number" className={inputCls} style={inputStyle} placeholder="0.00" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} />
          </div>
          <div>
            {label("Quantity / Shares")}
            <input type="number" className={inputCls} style={inputStyle} placeholder="e.g. 10" value={quantity} onChange={e => setQuantity(e.target.value)} />
          </div>
          <div>
            {label("Stop Loss (SL)")}
            <input type="number" className={inputCls} style={inputStyle} placeholder="0.00" value={sl} onChange={e => setSl(e.target.value)} />
          </div>
          <div>
            {label("Target 1 (TP1)")}
            <input type="number" className={inputCls} style={inputStyle} placeholder="0.00" value={tp1} onChange={e => setTp1(e.target.value)} />
          </div>
          <div className="col-span-2">
            {label("Target 2 (TP2) — optional")}
            <input type="number" className={inputCls} style={inputStyle} placeholder="0.00 (extended target)" value={tp2} onChange={e => setTp2(e.target.value)} />
          </div>
          <div className="col-span-2">
            {label("Trade Notes (optional)")}
            <textarea
              className={inputCls} style={inputStyle} rows={2}
              placeholder="e.g. Order block + SMC buy signal on 15m..."
              value={notes} onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button
            onClick={submit}
            className="flex-1 py-2.5 rounded-xl text-xs font-black text-white cursor-pointer transition-all hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg,#06b6d4,#3b82f6)" }}
          >
            ✅ Add Trade &amp; Start Monitoring
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
            style={{ background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Trade Card ───────────────────────────────────────────────────────────────
function TradeCard({ trade, onDelete, onNavigateSMC }: {
  trade: Trade;
  onDelete: (id: string) => void;
  onNavigateSMC: (sym: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status: TradeStatus = trade.status || "PENDING";
  const pnlPos = (trade.pnl || 0) >= 0;

  const rr = trade.entryPrice && trade.sl && trade.tp1
    ? Math.abs(trade.tp1 - trade.entryPrice) / Math.abs(trade.entryPrice - trade.sl)
    : 0;

  const slPct = ((Math.abs(trade.entryPrice - trade.sl) / trade.entryPrice) * 100).toFixed(2);
  const tp1Pct = ((Math.abs(trade.tp1 - trade.entryPrice) / trade.entryPrice) * 100).toFixed(2);
  const capitalAtRisk = Math.abs(trade.entryPrice - trade.sl) * trade.quantity;
  const tp1Profit = Math.abs(trade.tp1 - trade.entryPrice) * trade.quantity;
  const tp2Profit = trade.tp2 ? Math.abs(trade.tp2 - trade.entryPrice) * trade.quantity : 0;

  const barPct = (() => {
    if (!trade.currentPrice || !trade.sl || !trade.tp1) return 50;
    const range = Math.abs(trade.tp1 - trade.sl);
    if (range === 0) return 50;
    const pos = trade.side === "LONG"
      ? ((trade.currentPrice - trade.sl) / range) * 100
      : ((trade.sl - trade.currentPrice) / range) * 100;
    return Math.min(100, Math.max(0, pos));
  })();

  const barColor = barPct > 65 ? "#10b981" : barPct > 35 ? "#f59e0b" : "#ef4444";

  const borderColor = status === "SL_HIT"
    ? "rgba(239,68,68,0.25)"
    : status === "TP1_HIT" || status === "TP2_HIT"
    ? "rgba(16,185,129,0.25)"
    : "rgba(255,255,255,0.07)";

  const verdict =
    status === "SL_HIT"    ? "⛔ Stop Loss has been hit. Exit the trade immediately if not already done. Review the SMC structure to understand why the trade failed." :
    status === "TP1_HIT"   ? "✅ Target 1 reached! Consider booking 50% profit and moving Stop Loss to Entry (risk-free trade)." :
    status === "TP2_HIT"   ? "🎯 Full Target 2 hit! Outstanding trade. Book full profit and journal this as a winning trade." :
    status === "BREAKEVEN" ? "⚖️ Price is near entry. Consider moving SL to entry price to make the trade risk-free." :
    status === "HOLDING"   ? "⏳ Trade is open. Hold your position. Do NOT move SL against your trade. Wait for the market to reach TP or SL." :
                             "🔄 Fetching live market price…";

  const verdictColor =
    status === "SL_HIT"    ? "#ef4444" :
    status === "TP1_HIT" || status === "TP2_HIT" ? "#10b981" :
    status === "BREAKEVEN" ? "#94a3b8" : "#f59e0b";

  return (
    <div className="rounded-xl overflow-hidden transition-all" style={{ background: "rgba(10,13,20,0.7)", border: `1px solid ${borderColor}` }}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 cursor-pointer select-none" onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 flex items-center gap-3 flex-wrap min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-white">{trade.symbol}</span>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${trade.side === "LONG" ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>
                {trade.side === "LONG" ? "▲ LONG" : "▼ SHORT"}
              </span>
              <span className="text-[9px] text-slate-600">{trade.market.replace("_", " ")}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Entry {fmtCur(trade.market, trade.entryPrice)} · Qty {trade.quantity} · {new Date(trade.entryDate).toLocaleDateString("en-IN")}
            </div>
          </div>
          <StatusBadge status={status} />
          {trade.currentPrice !== undefined && (
            <span className="font-mono font-bold text-xs text-white">
              {fmtCur(trade.market, trade.currentPrice)}
            </span>
          )}
        </div>
        <div className="text-right shrink-0">
          {trade.pnl !== undefined && (
            <>
              <div className={`text-sm font-black font-mono ${pnlPos ? "text-emerald-400" : "text-red-400"}`}>
                {pnlPos ? "+" : ""}{fmtCur(trade.market, trade.pnl)}
              </div>
              <div className={`text-[10px] font-mono ${pnlPos ? "text-emerald-500/60" : "text-red-500/60"}`}>
                {pnlPos ? "+" : ""}{trade.pnlPct?.toFixed(2)}%
              </div>
            </>
          )}
        </div>
        <div className="text-slate-600 shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* SL ← price bar → TP */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 text-[9px] mb-1">
          <span className="text-red-400 shrink-0">SL {fmtCur(trade.market, trade.sl)}</span>
          <div className="flex-1 h-1.5 rounded-full relative overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
              style={{ width: `${barPct}%`, background: barColor }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-900 shadow-md"
              style={{ left: `${barPct}%` }}
            />
          </div>
          <span className="text-emerald-400 shrink-0">TP1 {fmtCur(trade.market, trade.tp1)}</span>
        </div>
      </div>

      {/* Expanded Full Report */}
      {expanded && (
        <div className="border-t px-4 py-4 space-y-4" style={{ borderColor: "rgba(255,255,255,0.05)" }}>

          {/* Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Risk : Reward", value: `1 : ${rr.toFixed(2)}`, color: rr >= 2 ? "#10b981" : rr >= 1 ? "#f59e0b" : "#ef4444" },
              { label: "SL Distance",   value: `${slPct}%`,            color: "#ef4444" },
              { label: "TP1 Distance",  value: `${tp1Pct}%`,           color: "#10b981" },
              { label: "Capital at Risk", value: fmtCur(trade.market, capitalAtRisk), color: "#f59e0b" },
            ].map(m => (
              <div key={m.label} className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">{m.label}</div>
                <div className="text-sm font-black font-mono" style={{ color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Full trade report table */}
          <div className="rounded-xl p-4 space-y-1.5" style={{ background: "rgba(6,182,212,0.03)", border: "1px solid rgba(6,182,212,0.1)" }}>
            <div className="text-xs font-bold text-cyan-300 mb-3">📊 Full Trade Report</div>
            {[
              { label: "Position Value",         val: fmtCur(trade.market, trade.entryPrice * trade.quantity), color: "#e2e8f0" },
              { label: "Max Loss (if SL hit)",   val: "−" + fmtCur(trade.market, capitalAtRisk), color: "#ef4444" },
              { label: "TP1 Potential Profit",   val: "+" + fmtCur(trade.market, tp1Profit), color: "#10b981" },
              { label: "TP2 Potential Profit",   val: trade.tp2 ? "+" + fmtCur(trade.market, tp2Profit) : "Not set", color: trade.tp2 ? "#f59e0b" : "#475569" },
              { label: "Live P&L Now",           val: trade.pnl !== undefined ? (trade.pnl >= 0 ? "+" : "−") + fmtCur(trade.market, trade.pnl) : "Fetching…", color: (trade.pnl || 0) >= 0 ? "#10b981" : "#ef4444" },
              { label: "Trade Verdict",          val: status.replace("_", " "), color: verdictColor, bold: true },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-center py-1.5 px-2 rounded-lg text-xs" style={{ background: "rgba(255,255,255,0.02)" }}>
                <span className="text-slate-500">{r.label}</span>
                <span className="font-mono font-bold" style={{ color: r.color, fontSize: r.bold ? "11px" : undefined }}>{r.val}</span>
              </div>
            ))}
          </div>

          {/* Recommendation */}
          <div
            className="rounded-xl p-3 flex items-start gap-2.5"
            style={{
              background: status === "SL_HIT" ? "rgba(239,68,68,0.06)" : status.includes("TP") ? "rgba(16,185,129,0.06)" : "rgba(245,158,11,0.06)",
              border: `1px solid ${verdictColor}25`,
            }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: verdictColor }} />
            <p className="text-[11px] leading-relaxed" style={{ color: verdictColor }}>{verdict}</p>
          </div>

          {/* Notes */}
          {trade.notes && (
            <div className="rounded-lg px-3 py-2 text-[10px] text-slate-500 italic" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              📝 {trade.notes}
            </div>
          )}

          {trade.lastUpdated && (
            <p className="text-[9px] text-slate-700 text-right">Last price update: {new Date(trade.lastUpdated).toLocaleTimeString()}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1 flex-wrap">
            <button
              onClick={() => onNavigateSMC(trade.symbol)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all hover:scale-105"
              style={{ background: "rgba(6,182,212,0.1)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.2)" }}
            >
              <BarChart2 className="w-3 h-3" /> Full SMC Analysis
            </button>
            <button
              onClick={() => onDelete(trade.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all hover:scale-105"
              style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}
            >
              <Trash2 className="w-3 h-3" /> Remove Trade
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Summary Stats Bar ────────────────────────────────────────────────────────
function SummaryStats({ trades }: { trades: Trade[] }) {
  const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
  const winners = trades.filter(t => t.status === "TP1_HIT" || t.status === "TP2_HIT").length;
  const losers  = trades.filter(t => t.status === "SL_HIT").length;
  const holding = trades.filter(t => t.status === "HOLDING" || t.status === "PENDING" || t.status === "BREAKEVEN").length;
  const winRate = (winners + losers) > 0 ? Math.round((winners / (winners + losers)) * 100) : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: "Total P&L",     value: (totalPnl >= 0 ? "+" : "") + totalPnl.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), color: totalPnl >= 0 ? "#10b981" : "#ef4444", icon: "💰" },
        { label: "Win Rate",      value: winRate !== null ? `${winRate}%` : "—",  color: winRate !== null ? (winRate >= 60 ? "#10b981" : winRate >= 40 ? "#f59e0b" : "#ef4444") : "#64748b", icon: "🏆" },
        { label: "Open Trades",   value: String(holding),      color: "#06b6d4", icon: "📊" },
        { label: "TP Hit / SL Hit", value: `${winners} / ${losers}`, color: "#94a3b8", icon: "🎯" },
      ].map(s => (
        <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-xl mb-1">{s.icon}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{s.label}</div>
          <div className="text-base font-black font-mono" style={{ color: s.color }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
  onNavigateToSMC?: (symbol: string) => void;
}

export default function TradeJournal({ onNavigateToSMC }: Props) {
  const [trades, setTrades]     = useState<Trade[]>(loadTrades);
  const [showForm, setShowForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown]   = useState(30);
  const [filter, setFilter] = useState<"ALL" | TradeStatus>("ALL");

  // ── Fetch live price for one trade ──────────────────────────────────────────
  const fetchPrice = async (symbol: string, market: Market): Promise<number | null> => {
    try {
      if (market === "CRYPTO") {
        const sym = symbol.endsWith("USDT") ? symbol : symbol + "USDT";
        const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`);
        const d = await r.json();
        return d.price ? parseFloat(d.price) : null;
      } else {
        // For Indian equity and Forex we use our own backend SMC endpoint which returns livePrice
        const yfSym = market === "INDIAN_EQUITY"
          ? (symbol.endsWith(".NS") ? symbol : symbol + ".NS")
          : symbol.length === 6
          ? symbol + "=X"
          : symbol;
        const r = await fetch(`/api/smc-report/${encodeURIComponent(yfSym)}`);
        const d = await r.json();
        return d.livePrice ?? null;
      }
    } catch { return null; }
  };

  // ── Refresh all open trades ──────────────────────────────────────────────────
  const refreshAllTrades = useCallback(async (currentTrades: Trade[]) => {
    if (currentTrades.length === 0) return;
    setRefreshing(true);
    const updated = await Promise.all(
      currentTrades.map(async (t) => {
        const cur = await fetchPrice(t.symbol, t.market);
        if (cur === null) return t;
        const status = computeStatus(t, cur);
        const pnl = t.side === "LONG"
          ? (cur - t.entryPrice) * t.quantity
          : (t.entryPrice - cur) * t.quantity;
        const pnlPct = (pnl / (t.entryPrice * t.quantity)) * 100;
        return { ...t, currentPrice: cur, status, pnl, pnlPct, lastUpdated: new Date().toISOString() } as Trade;
      })
    );
    setTrades(updated);
    saveTrades(updated);
    setRefreshing(false);
    setCountdown(30);
  }, []);

  // ── Auto-refresh every 30 seconds ────────────────────────────────────────────
  const tradesRef = useRef<Trade[]>(trades);
  tradesRef.current = trades;

  useEffect(() => {
    refreshAllTrades(tradesRef.current);
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          refreshAllTrades(tradesRef.current);
          return 30;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [refreshAllTrades]);

  // ── Add / Delete ─────────────────────────────────────────────────────────────
  const addTrade = (t: Trade) => {
    const next = [...tradesRef.current, t];
    setTrades(next);
    saveTrades(next);
    setTimeout(() => refreshAllTrades(next), 600);
  };

  const deleteTrade = (id: string) => {
    const next = tradesRef.current.filter(t => t.id !== id);
    setTrades(next);
    saveTrades(next);
  };

  const handleSMC = (symbol: string) => {
    const sym = symbol.endsWith(".NS") || symbol.includes("USDT") ? symbol : symbol + ".NS";
    if (onNavigateToSMC) onNavigateToSMC(sym);
  };

  // ── CSV Export ────────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const hdr = ["Symbol","Side","Market","Entry","SL","TP1","TP2","Qty","CurrentPrice","Status","PnL","PnLPct","EntryDate","Notes"];
    const rows = trades.map(t => [
      t.symbol, t.side, t.market, t.entryPrice, t.sl, t.tp1, t.tp2 || "",
      t.quantity, t.currentPrice ?? "", t.status ?? "", t.pnl?.toFixed(2) ?? "",
      t.pnlPct?.toFixed(2) ?? "", new Date(t.entryDate).toLocaleDateString("en-IN"), `"${t.notes}"`,
    ]);
    const csv = [hdr, ...rows].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `trade_journal_${Date.now()}.csv`;
    a.click();
  };

  const filtered = filter === "ALL" ? trades : trades.filter(t => t.status === filter);
  const FILTERS: { key: "ALL" | TradeStatus; label: string }[] = [
    { key: "ALL",     label: `All (${trades.length})` },
    { key: "HOLDING", label: `⏳ Holding (${trades.filter(t => t.status === "HOLDING").length})` },
    { key: "TP1_HIT", label: `✅ TP1 Hit (${trades.filter(t => t.status === "TP1_HIT").length})` },
    { key: "TP2_HIT", label: `🎯 TP2 Hit (${trades.filter(t => t.status === "TP2_HIT").length})` },
    { key: "SL_HIT",  label: `❌ SL Hit (${trades.filter(t => t.status === "SL_HIT").length})` },
  ];

  return (
    <div className="space-y-5 animate-fade-slide">
      {showForm && <AddTradeForm onAdd={addTrade} onClose={() => setShowForm(false)} />}

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,#06b6d4,#3b82f6)", boxShadow: "0 0 20px rgba(6,182,212,0.25)" }}
          >
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Trade Journal &amp; Live Monitor</h2>
            <p className="text-[10px] text-slate-500">Real-time SL / TP tracker · Auto-refresh every 30s</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-slate-600 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Refresh in {countdown}s
          </span>
          <button
            onClick={() => refreshAllTrades(tradesRef.current)}
            disabled={refreshing}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer"
            style={{ background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Updating…" : "Refresh Now"}
          </button>
          {trades.length > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer"
              style={{ background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Download className="w-3 h-3" /> Export CSV
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg,#06b6d4,#3b82f6)", color: "white" }}
          >
            <PlusCircle className="w-3.5 h-3.5" /> Add Trade
          </button>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      {trades.length > 0 && <SummaryStats trades={trades} />}

      {/* ── Filter Tabs ── */}
      {trades.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
              style={filter === f.key
                ? { background: "rgba(6,182,212,0.12)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.25)" }
                : { background: "rgba(255,255,255,0.03)", color: "#64748b", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Trade List ── */}
      <div className="space-y-3">
        {filtered.length === 0 && trades.length === 0 ? (
          // Empty state
          <div
            className="rounded-2xl flex flex-col items-center justify-center py-20 gap-5"
            style={{ background: "rgba(10,13,20,0.6)", border: "1px dashed rgba(6,182,212,0.15)" }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)" }}
            >
              <Target className="w-8 h-8 text-cyan-400/40" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-slate-300 font-bold text-sm">No Trades Logged Yet</p>
              <p className="text-slate-600 text-xs">
                Click <strong className="text-slate-400">+ Add Trade</strong> to log any open trade.<br />
                The app will monitor it live and tell you: <span className="text-emerald-400">TP Hit</span>, <span className="text-red-400">SL Hit</span>, or <span className="text-cyan-400">Still Holding</span>.
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg,#06b6d4,#3b82f6)", color: "white" }}
            >
              <PlusCircle className="w-4 h-4" /> Add Your First Trade
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-600 text-sm">No trades match this filter.</div>
        ) : (
          filtered.map(t => (
            <TradeCard
              key={t.id}
              trade={t}
              onDelete={deleteTrade}
              onNavigateSMC={handleSMC}
            />
          ))
        )}
      </div>

      {trades.length > 0 && (
        <p className="text-[9px] text-slate-700 text-center pb-2">
          Trades saved in your browser · Prices fetched from live Binance &amp; Yahoo Finance · Click any trade row to expand the full report
        </p>
      )}
    </div>
  );
}
