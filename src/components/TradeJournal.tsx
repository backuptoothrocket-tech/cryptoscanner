import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  PlusCircle, Trash2, RefreshCw, Target, Clock,
  AlertTriangle, BarChart2, Download, ChevronDown, ChevronUp,
  Send, History, CheckCircle2, XCircle, BookOpen
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Side   = "LONG" | "SHORT";
type Market = "INDIAN_EQUITY" | "CRYPTO" | "FOREX";
type TradeStatus = "HOLDING" | "SL_HIT" | "TP1_HIT" | "TP2_HIT" | "BREAKEVEN" | "PENDING";

interface TradeHistoryEntry {
  timestamp: string;
  status: string;
  price: number;
  pnl: number;
  pnlPct: number;
  telegramSent: boolean;
  note: string;
}

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
  isResolved?: boolean;
  resolvedAt?: string;
  resolvedStatus?: string;
  history?: TradeHistoryEntry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCur(market: Market, n: number) {
  return (market === "INDIAN_EQUITY" ? "₹" : "$") +
    Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function uid() { return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

function computeStatus(t: Trade, cur: number): TradeStatus {
  if (!cur) return "PENDING";
  if (t.side === "LONG") {
    if (cur <= t.sl)             return "SL_HIT";
    if (t.tp2 && cur >= t.tp2)  return "TP2_HIT";
    if (cur >= t.tp1)            return "TP1_HIT";
    if (Math.abs(cur - t.entryPrice) / t.entryPrice < 0.001) return "BREAKEVEN";
    return "HOLDING";
  } else {
    if (cur >= t.sl)             return "SL_HIT";
    if (t.tp2 && cur <= t.tp2)  return "TP2_HIT";
    if (cur <= t.tp1)            return "TP1_HIT";
    if (Math.abs(cur - t.entryPrice) / t.entryPrice < 0.001) return "BREAKEVEN";
    return "HOLDING";
  }
}
function calcRR(t: Trade) {
  if (!t.entryPrice || !t.sl || !t.tp1) return 0;
  return Math.abs(t.tp1 - t.entryPrice) / Math.abs(t.entryPrice - t.sl);
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiLoadTrades(): Promise<Trade[]> {
  try {
    const r = await fetch("/api/trades");
    const d = await r.json();
    return (d.trades || []) as Trade[];
  } catch { return []; }
}
async function apiCreateTrade(t: Trade): Promise<Trade | null> {
  try {
    const r = await fetch("/api/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(t) });
    const d = await r.json();
    return d.trade ?? null;
  } catch { return null; }
}
async function apiUpdateTrade(id: string, payload: Partial<Trade> & { currentPrice?: number; pnl?: number; pnlPct?: number; status?: string }): Promise<{ trade: Trade; telegramSent: boolean; statusChanged: boolean } | null> {
  try {
    const r = await fetch(`/api/trades/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return await r.json();
  } catch { return null; }
}
async function apiDeleteTrade(id: string): Promise<void> {
  try { await fetch(`/api/trades/${id}`, { method: "DELETE" }); } catch {}
}
async function apiClearResolved(): Promise<void> {
  try { await fetch("/api/trades/resolved/all", { method: "DELETE" }); } catch {}
}
async function apiManualSend(trade: Trade): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await fetch("/api/telegram/send-trade", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: trade.symbol, side: trade.side, market: trade.market,
        entryPrice: trade.entryPrice, quantity: trade.quantity,
        sl: trade.sl, tp1: trade.tp1, tp2: trade.tp2 || null,
        currentPrice: trade.currentPrice ?? null, status: trade.status ?? "PENDING",
        pnl: trade.pnl ?? null, pnlPct: trade.pnlPct ?? null,
        notes: trade.notes || "", entryDate: trade.entryDate, rr: calcRR(trade),
      }),
    });
    const d = await r.json();
    return d.success ? { success: true } : { success: false, error: d.error };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    HOLDING:   { label: "⏳ HOLDING",   color: "#06b6d4", bg: "rgba(6,182,212,0.1)" },
    SL_HIT:    { label: "❌ SL HIT",   color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
    TP1_HIT:   { label: "✅ TP1 HIT",  color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    TP2_HIT:   { label: "🎯 TP2 HIT",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
    BREAKEVEN: { label: "⚖️ BREAKEVEN",color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
    PENDING:   { label: "🔄 PENDING",  color: "#64748b", bg: "rgba(100,116,139,0.08)" },
  };
  const c = cfg[status] ?? cfg.PENDING;
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}40` }}>
      {c.label}
    </span>
  );
}

// ─── Add Trade Form ────────────────────────────────────────────────────────────
function AddTradeForm({ onAdd, onClose }: { onAdd: (t: Trade) => void; onClose: () => void }) {
  const [symbol, setSymbol] = useState(""); const [market, setMarket] = useState<Market>("INDIAN_EQUITY");
  const [side, setSide] = useState<Side>("LONG"); const [entryPrice, setEntry] = useState("");
  const [quantity, setQty] = useState(""); const [sl, setSl] = useState("");
  const [tp1, setTp1] = useState(""); const [tp2, setTp2] = useState(""); const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const iCls = "w-full px-3 py-2 rounded-lg text-xs text-white outline-none placeholder-slate-600 focus:ring-1 focus:ring-cyan-500/40";
  const iSt  = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" };
  const lbl  = (s: string) => <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">{s}</label>;
  const submit = () => {
    if (!symbol || !entryPrice || !quantity || !sl || !tp1) { setErr("Symbol, Entry, Qty, SL and TP1 required."); return; }
    onAdd({ id: uid(), symbol: symbol.toUpperCase().trim(), market, side, entryPrice: parseFloat(entryPrice), quantity: parseFloat(quantity), sl: parseFloat(sl), tp1: parseFloat(tp1), tp2: tp2 ? parseFloat(tp2) : 0, entryDate: new Date().toISOString(), notes, isResolved: false, history: [] });
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.78)" }}>
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: "#0d1117", border: "1px solid rgba(6,182,212,0.25)" }}>
        <div className="flex items-center justify-between"><h3 className="text-sm font-black text-white">📝 Add New Trade</h3><button onClick={onClose} className="text-slate-500 hover:text-white text-xs cursor-pointer">✕ Close</button></div>
        {err && <p className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded-lg">{err}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">{lbl("Symbol")}<input className={iCls} style={iSt} placeholder="e.g. RELIANCE, BTCUSDT, EURUSD" value={symbol} onChange={e => setSymbol(e.target.value)} /></div>
          <div>{lbl("Market")}<select className={iCls} style={iSt} value={market} onChange={e => setMarket(e.target.value as Market)}><option value="INDIAN_EQUITY">🇮🇳 Indian Equity (NSE)</option><option value="CRYPTO">🪙 Crypto (Binance)</option><option value="FOREX">🌍 Forex / Gold</option></select></div>
          <div>{lbl("Direction")}<select className={iCls} style={iSt} value={side} onChange={e => setSide(e.target.value as Side)}><option value="LONG">📈 LONG (Buy)</option><option value="SHORT">📉 SHORT (Sell)</option></select></div>
          <div>{lbl("Entry Price")}<input type="number" className={iCls} style={iSt} placeholder="0.00" value={entryPrice} onChange={e => setEntry(e.target.value)} /></div>
          <div>{lbl("Qty / Shares")}<input type="number" className={iCls} style={iSt} placeholder="e.g. 10" value={quantity} onChange={e => setQty(e.target.value)} /></div>
          <div>{lbl("Stop Loss (SL)")}<input type="number" className={iCls} style={iSt} placeholder="0.00" value={sl} onChange={e => setSl(e.target.value)} /></div>
          <div>{lbl("Target 1 (TP1)")}<input type="number" className={iCls} style={iSt} placeholder="0.00" value={tp1} onChange={e => setTp1(e.target.value)} /></div>
          <div className="col-span-2">{lbl("Target 2 (TP2) — optional")}<input type="number" className={iCls} style={iSt} placeholder="0.00" value={tp2} onChange={e => setTp2(e.target.value)} /></div>
          <div className="col-span-2">{lbl("Trade Notes")}<textarea className={iCls} style={iSt} rows={2} placeholder="e.g. Order block + SMC signal on 15m…" value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={submit} className="flex-1 py-2.5 rounded-xl text-xs font-black text-white cursor-pointer hover:scale-[1.02] transition-all" style={{ background: "linear-gradient(135deg,#06b6d4,#3b82f6)" }}>✅ Add Trade &amp; Start Monitoring</button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer" style={{ background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid rgba(255,255,255,0.08)" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Trade History Panel ───────────────────────────────────────────────────────
function TradeHistoryPanel({ history, market }: { history: TradeHistoryEntry[]; market: Market }) {
  if (!history || history.length === 0) return <p className="text-[10px] text-slate-600 text-center py-3">No history entries yet.</p>;
  const entries = [...history].reverse();
  return (
    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
      {entries.map((h, i) => (
        <div key={i} className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="shrink-0 mt-0.5">
            {h.status === "SL_HIT"  ? <XCircle className="w-3 h-3 text-red-400" /> :
             h.status === "TP1_HIT" || h.status === "TP2_HIT" ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> :
             h.status === "HOLDING" ? <Activity className="w-3 h-3 text-cyan-400" /> :
             <Clock className="w-3 h-3 text-slate-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-slate-300 leading-snug">{h.note}</p>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-[9px] text-slate-600">{new Date(h.timestamp).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}</span>
              {h.price > 0 && <span className="text-[9px] font-mono text-slate-500">{fmtCur(market, h.price)}</span>}
              {h.pnl !== 0 && <span className={`text-[9px] font-mono font-bold ${h.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{h.pnl >= 0 ? "+" : "−"}{fmtCur(market, h.pnl)}</span>}
              {h.telegramSent && <span className="text-[9px] text-green-500">📨 Telegram sent</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Trade Card ───────────────────────────────────────────────────────────────
function TradeCard({ trade, onDelete, onNavigateSMC }: {
  trade: Trade; onDelete: (id: string) => void; onNavigateSMC: (s: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending]   = useState(false);
  const [sendMsg, setSendMsg]   = useState<{ ok: boolean; text: string } | null>(null);
  const [showHist, setShowHist] = useState(false);

  const status    = trade.status || "PENDING";
  const pnlPos    = (trade.pnl || 0) >= 0;
  const rr        = calcRR(trade);
  const slPct     = ((Math.abs(trade.entryPrice - trade.sl)  / trade.entryPrice) * 100).toFixed(2);
  const tp1Pct    = ((Math.abs(trade.tp1 - trade.entryPrice) / trade.entryPrice) * 100).toFixed(2);
  const capRisk   = Math.abs(trade.entryPrice - trade.sl) * trade.quantity;
  const tp1Prof   = Math.abs(trade.tp1 - trade.entryPrice) * trade.quantity;
  const tp2Prof   = trade.tp2 ? Math.abs(trade.tp2 - trade.entryPrice) * trade.quantity : 0;
  const barPct    = (() => {
    if (!trade.currentPrice || !trade.sl || !trade.tp1) return 50;
    const range = Math.abs(trade.tp1 - trade.sl);
    if (!range) return 50;
    const pos = trade.side === "LONG" ? ((trade.currentPrice - trade.sl) / range) * 100 : ((trade.sl - trade.currentPrice) / range) * 100;
    return Math.min(100, Math.max(0, pos));
  })();
  const borderColor  = status === "SL_HIT" ? "rgba(239,68,68,0.25)" : status.includes("TP") ? "rgba(16,185,129,0.25)" : trade.isResolved ? "rgba(100,116,139,0.2)" : "rgba(255,255,255,0.07)";
  const verdictColor = status === "SL_HIT" ? "#ef4444" : status.includes("TP") ? "#10b981" : status === "BREAKEVEN" ? "#94a3b8" : "#f59e0b";
  const verdict = status === "SL_HIT" ? "⛔ Stop Loss hit — Exit immediately if not already done." : status === "TP1_HIT" ? "✅ Target 1 reached! Book 50% profit and move SL to entry." : status === "TP2_HIT" ? "🎯 Full Target 2 hit! Book all profit." : status === "BREAKEVEN" ? "⚖️ Price near entry. Move SL to entry (risk-free)." : status === "HOLDING" ? "⏳ Trade open. Hold your position — do NOT widen SL." : "🔄 Fetching live price…";

  const handleSend = async () => {
    setSending(true); setSendMsg(null);
    const r = await apiManualSend(trade);
    setSendMsg({ ok: r.success, text: r.success ? "✅ Sent to Telegram!" : `❌ ${r.error}` });
    setSending(false);
    setTimeout(() => setSendMsg(null), 5000);
  };

  const histCount = (trade.history || []).length;

  return (
    <div className="rounded-xl overflow-hidden transition-all" style={{ background: "rgba(10,13,20,0.7)", border: `1px solid ${borderColor}` }}>
      {/* Resolved banner */}
      {trade.isResolved && (
        <div className="px-4 py-1.5 text-[9px] font-bold flex items-center gap-1.5" style={{ background: trade.resolvedStatus === "SL_HIT" ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)", color: trade.resolvedStatus === "SL_HIT" ? "#ef4444" : "#10b981" }}>
          <CheckCircle2 className="w-3 h-3" />
          TRADE CLOSED · {trade.resolvedStatus?.replace("_", " ")} · {trade.resolvedAt ? new Date(trade.resolvedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center gap-3 p-4 cursor-pointer select-none" onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 flex items-center gap-3 flex-wrap min-w-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-white">{trade.symbol}</span>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${trade.side === "LONG" ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>{trade.side === "LONG" ? "▲ LONG" : "▼ SHORT"}</span>
              <span className="text-[9px] text-slate-600">{trade.market.replace("_", " ")}</span>
              {histCount > 1 && <span className="text-[9px] text-slate-600 flex items-center gap-0.5"><History className="w-2.5 h-2.5" />{histCount} events</span>}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Entry {fmtCur(trade.market, trade.entryPrice)} · Qty {trade.quantity} · {new Date(trade.entryDate).toLocaleDateString("en-IN")}</div>
          </div>
          <StatusBadge status={status} />
          {trade.currentPrice !== undefined && <span className="font-mono font-bold text-xs text-white">{fmtCur(trade.market, trade.currentPrice)}</span>}
        </div>
        <div className="text-right shrink-0">
          {trade.pnl !== undefined && (<><div className={`text-sm font-black font-mono ${pnlPos ? "text-emerald-400" : "text-red-400"}`}>{pnlPos ? "+" : "−"}{fmtCur(trade.market, trade.pnl)}</div><div className={`text-[10px] font-mono ${pnlPos ? "text-emerald-500/60" : "text-red-500/60"}`}>{pnlPos ? "+" : ""}{trade.pnlPct?.toFixed(2)}%</div></>)}
        </div>
        <div className="text-slate-600 shrink-0">{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 text-[9px]">
          <span className="text-red-400 shrink-0">SL {fmtCur(trade.market, trade.sl)}</span>
          <div className="flex-1 h-1.5 rounded-full relative overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${barPct}%`, background: barPct > 65 ? "#10b981" : barPct > 35 ? "#f59e0b" : "#ef4444" }} />
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-900 shadow" style={{ left: `${barPct}%` }} />
          </div>
          <span className="text-emerald-400 shrink-0">TP1 {fmtCur(trade.market, trade.tp1)}</span>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t px-4 py-4 space-y-4" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Risk:Reward",     val: `1 : ${rr.toFixed(2)}`, color: rr >= 2 ? "#10b981" : rr >= 1 ? "#f59e0b" : "#ef4444" },
              { label: "SL Distance",     val: `${slPct}%`,             color: "#ef4444" },
              { label: "TP1 Distance",    val: `${tp1Pct}%`,            color: "#10b981" },
              { label: "Capital at Risk", val: fmtCur(trade.market, capRisk), color: "#f59e0b" },
            ].map(m => (
              <div key={m.label} className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">{m.label}</div>
                <div className="text-sm font-black font-mono" style={{ color: m.color }}>{m.val}</div>
              </div>
            ))}
          </div>

          {/* Full report table */}
          <div className="rounded-xl p-4 space-y-1.5" style={{ background: "rgba(6,182,212,0.03)", border: "1px solid rgba(6,182,212,0.1)" }}>
            <div className="text-xs font-bold text-cyan-300 mb-3">📊 Full Trade Report</div>
            {[
              { label: "Position Value",       val: fmtCur(trade.market, trade.entryPrice * trade.quantity), color: "#e2e8f0" },
              { label: "Max Loss (SL hit)",    val: "−" + fmtCur(trade.market, capRisk), color: "#ef4444" },
              { label: "TP1 Potential Profit", val: "+" + fmtCur(trade.market, tp1Prof), color: "#10b981" },
              { label: "TP2 Potential Profit", val: trade.tp2 ? "+" + fmtCur(trade.market, tp2Prof) : "Not set", color: trade.tp2 ? "#f59e0b" : "#475569" },
              { label: "Live P&L Now",         val: trade.pnl !== undefined ? (trade.pnl >= 0 ? "+" : "−") + fmtCur(trade.market, trade.pnl) : "Fetching…", color: (trade.pnl || 0) >= 0 ? "#10b981" : "#ef4444" },
              { label: "Outcome",              val: trade.isResolved ? (trade.resolvedStatus?.replace(/_/g," ") ?? "Closed") : status.replace(/_/g," "), color: verdictColor, bold: true },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-center py-1.5 px-2 rounded-lg text-xs" style={{ background: "rgba(255,255,255,0.02)" }}>
                <span className="text-slate-500">{r.label}</span>
                <span className="font-mono font-bold" style={{ color: r.color, fontSize: r.bold ? "11px" : undefined }}>{r.val}</span>
              </div>
            ))}
          </div>

          {/* Verdict */}
          <div className="rounded-xl p-3 flex items-start gap-2.5" style={{ background: status === "SL_HIT" ? "rgba(239,68,68,0.06)" : status.includes("TP") ? "rgba(16,185,129,0.06)" : "rgba(245,158,11,0.06)", border: `1px solid ${verdictColor}25` }}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: verdictColor }} />
            <p className="text-[11px] leading-relaxed" style={{ color: verdictColor }}>{verdict}</p>
          </div>

          {/* History log toggle */}
          <div>
            <button onClick={() => setShowHist(h => !h)}
              className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-200 cursor-pointer transition-colors mb-2">
              <History className="w-3.5 h-3.5" />
              Trade History ({(trade.history || []).length} events)
              {showHist ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showHist && <TradeHistoryPanel history={trade.history || []} market={trade.market} />}
          </div>

          {trade.notes && <div className="rounded-lg px-3 py-2 text-[10px] text-slate-500 italic" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>📝 {trade.notes}</div>}
          {trade.lastUpdated && <p className="text-[9px] text-slate-700 text-right">Last updated: {new Date(trade.lastUpdated).toLocaleTimeString()}</p>}

          {/* Send result */}
          {sendMsg && (
            <div className="rounded-lg px-3 py-2 text-[11px] font-semibold" style={{ background: sendMsg.ok ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: sendMsg.ok ? "#10b981" : "#ef4444", border: `1px solid ${sendMsg.ok ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}` }}>{sendMsg.text}</div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap pt-1">
            <button onClick={handleSend} disabled={sending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black cursor-pointer transition-all hover:scale-105 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,rgba(37,211,102,0.15),rgba(37,211,102,0.08))", color: "#25d366", border: "1px solid rgba(37,211,102,0.25)" }}>
              <Send className="w-3 h-3" />{sending ? "Sending…" : "📨 Send to Telegram"}
            </button>
            <button onClick={() => onNavigateSMC(trade.symbol)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all hover:scale-105"
              style={{ background: "rgba(6,182,212,0.1)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.2)" }}>
              <BarChart2 className="w-3 h-3" /> SMC Analysis
            </button>
            <button onClick={() => onDelete(trade.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all hover:scale-105"
              style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}>
              <Trash2 className="w-3 h-3" /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Summary Stats ────────────────────────────────────────────────────────────
function SummaryStats({ trades }: { trades: Trade[] }) {
  const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
  const winners  = trades.filter(t => t.status === "TP1_HIT" || t.status === "TP2_HIT").length;
  const losers   = trades.filter(t => t.status === "SL_HIT").length;
  const holding  = trades.filter(t => !t.isResolved).length;
  const winRate  = (winners + losers) > 0 ? Math.round((winners / (winners + losers)) * 100) : null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: "Total P&L",       val: (totalPnl >= 0 ? "+" : "") + totalPnl.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), color: totalPnl >= 0 ? "#10b981" : "#ef4444", icon: "💰" },
        { label: "Win Rate",        val: winRate !== null ? `${winRate}%` : "—", color: winRate !== null ? (winRate >= 60 ? "#10b981" : winRate >= 40 ? "#f59e0b" : "#ef4444") : "#64748b", icon: "🏆" },
        { label: "Open Trades",     val: String(holding), color: "#06b6d4", icon: "📊" },
        { label: "TP Hit / SL Hit", val: `${winners} / ${losers}`, color: "#94a3b8", icon: "🎯" },
      ].map(s => (
        <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-xl mb-1">{s.icon}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{s.label}</div>
          <div className="text-base font-black font-mono" style={{ color: s.color }}>{s.val}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Activity import fix (used in TradeHistoryPanel) ─────────────────────────
import { Activity } from "lucide-react";

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props { onNavigateToSMC?: (symbol: string) => void; }

interface PnlAccount {
  totalAccountPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  winRatePct: number;
  totalTrades: number;
  openTradesCount: number;
  closedTradesCount: number;
  winnersCount: number;
  losersCount: number;
  holdingCount: number;
}

export default function TradeJournal({ onNavigateToSMC }: Props) {
  const [trades, setTrades]         = useState<Trade[]>([]);
  const [showForm, setShowForm]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown]   = useState(30);
  const [filter, setFilter]         = useState<"OPEN" | "CLOSED" | "ALL">("OPEN");
  const [loading, setLoading]       = useState(true);
  const [pnlAccount, setPnlAccount] = useState<PnlAccount | null>(null);
  const tradesRef = useRef<Trade[]>(trades);
  tradesRef.current = trades;

  // ── Load from backend on mount ────────────────────────────────────────────
  const fetchPnlAccount = useCallback(async () => {
    try {
      const r = await fetch("/api/trades/pnl-account");
      const d = await r.json();
      setPnlAccount(d);
    } catch {}
  }, []);

  useEffect(() => {
    apiLoadTrades().then(t => { setTrades(t); setLoading(false); });
    fetchPnlAccount();
  }, [fetchPnlAccount]);

  // ── Fetch live price ──────────────────────────────────────────────────────
  const fetchPrice = async (symbol: string, market: Market): Promise<number | null> => {
    try {
      if (market === "CRYPTO") {
        const sym = symbol.endsWith("USDT") ? symbol : symbol + "USDT";
        const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`);
        const d = await r.json();
        return d.price ? parseFloat(d.price) : null;
      } else {
        const yfSym = market === "INDIAN_EQUITY" ? (symbol.endsWith(".NS") ? symbol : symbol + ".NS") : symbol.length === 6 ? symbol + "=X" : symbol;
        const r = await fetch(`/api/smc-report/${encodeURIComponent(yfSym)}`);
        const d = await r.json();
        return d.livePrice ?? null;
      }
    } catch { return null; }
  };

  // ── Refresh all open trades, update backend with status + auto-send Telegram ─
  const refreshAll = useCallback(async (current: Trade[]) => {
    const open = current.filter(t => !t.isResolved);
    if (!open.length) return;
    setRefreshing(true);
    const updatedAll = await Promise.all(current.map(async t => {
      if (t.isResolved) return t; // skip closed trades
      const cur = await fetchPrice(t.symbol, t.market);
      if (cur === null) return t;
      const status = computeStatus(t, cur);
      const pnl    = t.side === "LONG" ? (cur - t.entryPrice) * t.quantity : (t.entryPrice - cur) * t.quantity;
      const pnlPct = (pnl / (t.entryPrice * t.quantity)) * 100;
      // Push update to backend (which handles auto-Telegram + history logging)
      const res = await apiUpdateTrade(t.id, { currentPrice: cur, status, pnl, pnlPct });
      return res?.trade ?? { ...t, currentPrice: cur, status, pnl, pnlPct, lastUpdated: new Date().toISOString() };
    }));
    setTrades(updatedAll as Trade[]);
    setRefreshing(false);
    setCountdown(30);
  }, []);

  // ── Periodic refresh every 30s ────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    refreshAll(tradesRef.current);
    const tick = setInterval(() => {
      setCountdown(c => { if (c <= 1) { refreshAll(tradesRef.current); return 30; } return c - 1; });
    }, 1000);
    return () => clearInterval(tick);
  }, [refreshAll, loading]);

  // ── Add trade ─────────────────────────────────────────────────────────────
  const addTrade = async (t: Trade) => {
    const saved = await apiCreateTrade(t);
    if (saved) {
      const next = [...tradesRef.current, saved];
      setTrades(next);
      setTimeout(() => refreshAll(next), 600);
    }
  };

  // ── Delete trade ─────────────────────────────────────────────────────────
  const deleteTrade = async (id: string) => {
    await apiDeleteTrade(id);
    const next = tradesRef.current.filter(t => t.id !== id);
    setTrades(next);
  };

  // ── Clear resolved ────────────────────────────────────────────────────────
  const clearResolved = async () => {
    await apiClearResolved();
    const next = tradesRef.current.filter(t => !t.isResolved);
    setTrades(next);
  };

  const handleSMC = (symbol: string) => {
    const sym = symbol.endsWith(".NS") || symbol.includes("USDT") ? symbol : symbol + ".NS";
    if (onNavigateToSMC) onNavigateToSMC(sym);
  };

  const exportCSV = () => {
    const hdr  = ["Symbol","Side","Market","Entry","SL","TP1","TP2","Qty","CurrentPrice","Status","PnL","PnLPct","EntryDate","ResolvedAt","ResolvedStatus","Notes"];
    const rows = trades.map(t => [t.symbol, t.side, t.market, t.entryPrice, t.sl, t.tp1, t.tp2||"", t.quantity, t.currentPrice??"", t.status??"", t.pnl?.toFixed(2)??"", t.pnlPct?.toFixed(2)??"", new Date(t.entryDate).toLocaleDateString("en-IN"), t.resolvedAt ? new Date(t.resolvedAt).toLocaleDateString("en-IN") : "", t.resolvedStatus??"", `"${t.notes}"`]);
    const csv  = [hdr, ...rows].map(r => r.join(",")).join("\n");
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `trade_journal_${Date.now()}.csv`;
    a.click();
  };

  const openTrades   = trades.filter(t => !t.isResolved);
  const closedTrades = trades.filter(t => t.isResolved);
  const displayed    = filter === "OPEN" ? openTrades : filter === "CLOSED" ? closedTrades : trades;

  const FILTERS = [
    { key: "OPEN"   as const, label: `📊 Open (${openTrades.length})` },
    { key: "CLOSED" as const, label: `🏁 Closed (${closedTrades.length})` },
    { key: "ALL"    as const, label: `All (${trades.length})` },
  ];

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-2 text-slate-500 text-sm"><RefreshCw className="w-4 h-4 animate-spin" /> Loading trades from server…</div>
    </div>
  );

  const handleRefreshAll = () => { refreshAll(tradesRef.current); fetchPnlAccount(); };

  return (
    <div className="space-y-5 animate-fade-slide">
      {showForm && <AddTradeForm onAdd={addTrade} onClose={() => setShowForm(false)} />}

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#06b6d4,#3b82f6)", boxShadow: "0 0 20px rgba(6,182,212,0.25)" }}>
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Trade Journal — Auto-Record &amp; Monitor</h2>
            <p className="text-[10px] text-slate-500">Server-persisted · 24/7 Auto Monitoring · Telegram SL/TP Alerts · Full History</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-bold text-green-400">24/7 SERVER MONITOR</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-slate-600 flex items-center gap-1"><Clock className="w-3 h-3" />{countdown}s</span>
          <button onClick={handleRefreshAll} disabled={refreshing} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer" style={{ background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid rgba(255,255,255,0.08)" }}>
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />{refreshing ? "Updating…" : "Refresh"}
          </button>
          {closedTrades.length > 0 && (
            <button onClick={clearResolved} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer" style={{ background: "rgba(239,68,68,0.06)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}>
              <Trash2 className="w-3 h-3" /> Clear Closed
            </button>
          )}
          {trades.length > 0 && (
            <button onClick={exportCSV} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer" style={{ background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Download className="w-3 h-3" /> Export CSV
            </button>
          )}
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:scale-105 transition-all" style={{ background: "linear-gradient(135deg,#06b6d4,#3b82f6)", color: "white" }}>
            <PlusCircle className="w-3.5 h-3.5" /> Add Trade
          </button>
        </div>
      </div>

      {/* ── P&L Account Dashboard Card ── */}
      {pnlAccount && (
        <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.06), rgba(59,130,246,0.06))", border: "1px solid rgba(6,182,212,0.15)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">📊 P&amp;L Account — Full Summary</div>
              <div className="text-[9px] text-slate-600">Automatically maintained by 24/7 server monitor · Updates every 30s</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Net Account P&amp;L</div>
              <div className={`text-2xl font-black font-mono ${pnlAccount.totalAccountPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {pnlAccount.totalAccountPnl >= 0 ? "+" : "−"}{Math.abs(pnlAccount.totalAccountPnl).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Realized P&L",    val: (pnlAccount.realizedPnl >= 0 ? "+" : "") + pnlAccount.realizedPnl.toFixed(2),   color: pnlAccount.realizedPnl >= 0 ? "#10b981" : "#ef4444",   icon: "✅", sub: `${pnlAccount.closedTradesCount} closed trades` },
              { label: "Unrealized P&L",  val: (pnlAccount.unrealizedPnl >= 0 ? "+" : "") + pnlAccount.unrealizedPnl.toFixed(2), color: pnlAccount.unrealizedPnl >= 0 ? "#06b6d4" : "#f59e0b",  icon: "⏳", sub: `${pnlAccount.openTradesCount} open trades` },
              { label: "Win Rate",         val: pnlAccount.winRatePct > 0 ? `${pnlAccount.winRatePct}%` : "—",                  color: pnlAccount.winRatePct >= 60 ? "#10b981" : pnlAccount.winRatePct >= 40 ? "#f59e0b" : "#ef4444", icon: "🏆", sub: `${pnlAccount.winnersCount}W / ${pnlAccount.losersCount}L` },
              { label: "Holding / Total",  val: `${pnlAccount.holdingCount} / ${pnlAccount.totalTrades}`,                       color: "#94a3b8",                                              icon: "📈", sub: "All time trades" },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="text-xl mb-1">{s.icon}</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">{s.label}</div>
                <div className="text-sm font-black font-mono" style={{ color: s.color }}>{s.val}</div>
                <div className="text-[9px] text-slate-600 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Auto-alert notice ── */}
      <div className="rounded-xl px-4 py-2.5 flex items-start gap-2.5 text-[10px]" style={{ background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.15)", color: "#25d366" }}>
        <Send className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          <strong>24/7 Auto-Journal is ACTIVE</strong> — Every trade sent via Telegram bot is <strong>automatically recorded</strong> in this journal.
          The server monitors SL &amp; TP every 30s and <strong>fires a Telegram alert</strong> the moment the price crosses SL or TP.
          P&amp;L is computed and updated live. Records persist forever even when your browser is closed.
        </span>
      </div>

      {/* ── Stats ── */}
      {trades.length > 0 && <SummaryStats trades={trades} />}

      {/* ── Filters ── */}
      {trades.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
              style={filter === f.key ? { background: "rgba(6,182,212,0.12)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.25)" } : { background: "rgba(255,255,255,0.03)", color: "#64748b", border: "1px solid rgba(255,255,255,0.06)" }}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Trade List ── */}
      <div className="space-y-3">
        {displayed.length === 0 && trades.length === 0 ? (
          <div className="rounded-2xl flex flex-col items-center justify-center py-20 gap-5" style={{ background: "rgba(10,13,20,0.6)", border: "1px dashed rgba(6,182,212,0.15)" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)" }}>
              <BookOpen className="w-8 h-8 text-cyan-400/40" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-slate-300 font-bold text-sm">Trade Journal is Empty</p>
              <p className="text-slate-600 text-xs max-w-xs mx-auto">
                Add any trade you've taken. The app monitors it <strong className="text-slate-400">live every 30 seconds</strong>,
                keeps a full history log, and sends you a <span className="text-green-400">📨 Telegram alert</span> the moment
                <span className="text-red-400"> SL</span> or <span className="text-emerald-400"> TP</span> is hit.
              </p>
            </div>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold cursor-pointer hover:scale-105 transition-all" style={{ background: "linear-gradient(135deg,#06b6d4,#3b82f6)", color: "white" }}>
              <PlusCircle className="w-4 h-4" /> Add Your First Trade
            </button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-10 text-slate-600 text-sm">No {filter.toLowerCase()} trades.</div>
        ) : (
          displayed.map(t => <TradeCard key={t.id} trade={t} onDelete={deleteTrade} onNavigateSMC={handleSMC} />)
        )}
      </div>

      {trades.length > 0 && (
        <p className="text-[9px] text-slate-700 text-center pb-2">
          All trades saved on server · History logged on every status change · Click a trade row to expand full report, history &amp; send to Telegram
        </p>
      )}
    </div>
  );
}
