import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  TrendingUp, TrendingDown, Activity, Zap, Search, RefreshCw,
  BarChart2, Star, Globe, IndianRupee, ChevronUp, ChevronDown,
  Clock, Database, Flame, Award, Filter, ArrowUpRight, Target
} from "lucide-react";

interface IndiaStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  marketCap?: number;
  sector?: string;
  yearHigh?: number;
  yearLow?: number;
  pe?: number;
}

interface NiftyIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  prevClose: number;
}

type SubTab = "gainers" | "losers" | "most-active" | "etfs" | "top-performers" | "all-stocks";

function fmtPrice(n: number) {
  if (!n) return "—";
  return "?" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtVol(n: number) {
  if (!n) return "—";
  if (n >= 1e7) return (n / 1e7).toFixed(2) + " Cr";
  if (n >= 1e5) return (n / 1e5).toFixed(2) + " L";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toString();
}

function PctBadge({ val }: { val: number }) {
  const up = val >= 0;
  return (
    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: up ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)", color: up ? "#10b981" : "#ef4444" }}>
      {up ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      {Math.abs(val).toFixed(2)}%
    </span>
  );
}

function StockTable({ stocks, onAnalyze, loading, emptyMsg }: {
  stocks: IndiaStock[]; onAnalyze: (s: IndiaStock) => void; loading: boolean; emptyMsg?: string;
}) {
  const [sort, setSort] = useState<{ col: keyof IndiaStock; dir: 1 | -1 }>({ col: "changePct", dir: -1 });
  const [search, setSearch] = useState("");

  const sorted = [...stocks]
    .filter(s => !search || s.symbol.toUpperCase().includes(search.toUpperCase()) || s.name.toUpperCase().includes(search.toUpperCase()))
    .sort((a, b) => {
      const av = (a[sort.col] as number) ?? 0;
      const bv = (b[sort.col] as number) ?? 0;
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
    });

  const th = (col: keyof IndiaStock, lbl: string) => (
    <th onClick={() => setSort(s => ({ col, dir: s.col === col ? (-s.dir as 1 | -1) : -1 }))}
      className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap"
      style={{ color: sort.col === col ? "#06b6d4" : "#64748b" }}>
      <span className="flex items-center gap-1">
        {lbl}
        {sort.col === col && (sort.dir === -1 ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
      </span>
    </th>
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
      <p className="text-xs text-slate-500">Fetching live NSE data…</p>
    </div>
  );

  return (
    <div>
      {stocks.length > 0 && (
        <div className="mb-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter by name or symbol…"
            className="w-full pl-9 pr-4 py-2 rounded-lg text-xs text-white outline-none placeholder-slate-600"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
        </div>
      )}
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-slate-600 text-sm">{emptyMsg || "No data. NSE may be closed or rate-limited."}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <table className="w-full text-sm" style={{ background: "rgba(10,13,20,0.8)" }}>
            <thead style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-600 w-8">#</th>
                {th("symbol", "Symbol")}
                {th("price", "LTP")}
                {th("changePct", "Chg %")}
                {th("change", "Chg ?")}
                {th("volume", "Volume")}
                {th("high", "High")}
                {th("low", "Low")}
                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr key={s.symbol} className="border-t hover:bg-white/[0.025] transition-colors group"
                  style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  <td className="px-3 py-2.5 text-[10px] text-slate-600 font-mono">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-white text-xs">{s.symbol}</div>
                    <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{s.name || "—"}</div>
                  </td>
                  <td className="px-3 py-2.5 font-mono font-bold text-white text-xs whitespace-nowrap">{fmtPrice(s.price)}</td>
                  <td className="px-3 py-2.5"><PctBadge val={s.changePct} /></td>
                  <td className={`px-3 py-2.5 text-xs font-mono font-bold ${s.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {s.change >= 0 ? "+" : ""}{s.change.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-400 font-mono">{fmtVol(s.volume)}</td>
                  <td className="px-3 py-2.5 text-[11px] text-emerald-400/70 font-mono">{fmtPrice(s.high)}</td>
                  <td className="px-3 py-2.5 text-[11px] text-red-400/70 font-mono">{fmtPrice(s.low)}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => onAnalyze(s)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                      style={{ background: "rgba(6,182,212,0.12)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.2)" }}>
                      <Target className="w-3 h-3" /> Analyze
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AllStocksTab({ onAnalyze }: { onAnalyze: (s: IndiaStock) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/india/all-stocks").then(r => r.json()).then(d => setTotal(d.total || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const d = await fetch(`/api/india/search?q=${encodeURIComponent(query)}`).then(r => r.json());
        setResults(d.results || []);
      } catch {}
      setLoading(false);
    }, 300);
  }, [query]);

  return (
    <div>
      <div className="mb-4 p-3 rounded-xl flex items-center gap-3"
        style={{ background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.1)" }}>
        <Database className="w-4 h-4 text-cyan-400 shrink-0" />
        <div>
          <p className="text-xs font-bold text-cyan-300">NSE Listed Equities Database</p>
          <p className="text-[10px] text-slate-500">
            {total > 0 ? `${total.toLocaleString()} EQ-series stocks loaded` : "Loading…"} · Updated daily from NSE Archives
          </p>
        </div>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        {loading && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />}
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search any Indian stock — RELIANCE, Tata, HDFC, Infosys…"
          className="w-full pl-10 pr-10 py-3 rounded-xl text-sm text-white outline-none placeholder-slate-600"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
      </div>
      {query.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Start typing to search all NSE-listed stocks</p>
          <p className="text-slate-700 text-xs mt-1">Covers all {total > 0 ? total.toLocaleString() : "2,000+"} equities listed on NSE</p>
        </div>
      )}
      {results.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <table className="w-full text-sm" style={{ background: "rgba(10,13,20,0.8)" }}>
            <thead style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600">Symbol</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600">Company Name</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600">ISIN</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {results.map((s, i) => (
                <tr key={i} className="border-t hover:bg-white/[0.025] transition-colors group"
                  style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  <td className="px-4 py-3 font-bold text-cyan-300 text-xs">{s.symbol}</td>
                  <td className="px-4 py-3 text-xs text-white">{s.name}</td>
                  <td className="px-4 py-3 text-[10px] text-slate-500 font-mono">{s.isin || "—"}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onAnalyze({ symbol: s.symbol, name: s.name, price: 0, change: 0, changePct: 0, volume: 0, high: 0, low: 0, open: 0, prevClose: 0 })}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer"
                      style={{ background: "rgba(6,182,212,0.12)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.2)" }}>
                      <Target className="w-3 h-3" /> Analyze
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface Props {
  onNavigateToSMC?: (symbol: string) => void;
}

export default function IndiaMarket({ onNavigateToSMC }: Props) {
  const [subTab, setSubTab] = useState<SubTab>("gainers");
  const [gainers, setGainers] = useState<IndiaStock[]>([]);
  const [losers, setLosers] = useState<IndiaStock[]>([]);
  const [mostActiveVol, setMostActiveVol] = useState<IndiaStock[]>([]);
  const [mostActiveVal, setMostActiveVal] = useState<IndiaStock[]>([]);
  const [etfs, setEtfs] = useState<IndiaStock[]>([]);
  const [topPerformers, setTopPerformers] = useState<IndiaStock[]>([]);
  const [indices, setIndices] = useState<NiftyIndex[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({ gainers: true, losers: true, "most-active": true, etfs: true, "top-performers": true });
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [activeVolTab, setActiveVolTab] = useState<"volume" | "value">("volume");
  const [source, setSource] = useState("NSE India + Yahoo Finance");

  const setTabLoading = (tab: string, val: boolean) =>
    setLoading(prev => ({ ...prev, [tab]: val }));

  const fetchIndices = useCallback(async () => {
    try {
      const d = await fetch("/api/india/nifty-indices").then(r => r.json());
      setIndices(d.indices || []);
    } catch {}
  }, []);

  const fetchGainers = useCallback(async () => {
    setTabLoading("gainers", true);
    try {
      const d = await fetch("/api/india/gainers").then(r => r.json());
      setGainers(d.stocks || []);
      if (d.source === "NSE_LIVE") setSource("NSE India (Live)");
    } catch {}
    setTabLoading("gainers", false);
  }, []);

  const fetchLosers = useCallback(async () => {
    setTabLoading("losers", true);
    try {
      const d = await fetch("/api/india/losers").then(r => r.json());
      setLosers(d.stocks || []);
    } catch {}
    setTabLoading("losers", false);
  }, []);

  const fetchMostActive = useCallback(async () => {
    setTabLoading("most-active", true);
    try {
      const d = await fetch("/api/india/most-active").then(r => r.json());
      setMostActiveVol(d.byVolume || []);
      setMostActiveVal(d.byValue || []);
    } catch {}
    setTabLoading("most-active", false);
  }, []);

  const fetchETFs = useCallback(async () => {
    setTabLoading("etfs", true);
    try {
      const d = await fetch("/api/india/trending-etfs").then(r => r.json());
      setEtfs(d.etfs || []);
    } catch {}
    setTabLoading("etfs", false);
  }, []);

  const fetchTopPerformers = useCallback(async () => {
    setTabLoading("top-performers", true);
    try {
      const d = await fetch("/api/india/top-performers").then(r => r.json());
      setTopPerformers(d.stocks || []);
    } catch {}
    setTabLoading("top-performers", false);
  }, []);

  const refreshAll = useCallback(async () => {
    setLastRefresh(new Date());
    setCountdown(60);
    await Promise.all([
      fetchIndices(), fetchGainers(), fetchLosers(),
      fetchMostActive(), fetchETFs(), fetchTopPerformers(),
    ]);
  }, [fetchIndices, fetchGainers, fetchLosers, fetchMostActive, fetchETFs, fetchTopPerformers]);

  useEffect(() => { refreshAll(); }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { refreshAll(); return 60; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [refreshAll]);

  const isMarketOpen = () => {
    const now = new Date();
    const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const h = ist.getHours(), m = ist.getMinutes(), day = ist.getDay();
    if (day === 0 || day === 6) return false;
    const mins = h * 60 + m;
    return mins >= 555 && mins <= 930;
  };
  const marketOpen = isMarketOpen();

  const handleAnalyze = (s: IndiaStock) => {
    const sym = s.symbol.endsWith(".NS") ? s.symbol : `${s.symbol}.NS`;
    if (onNavigateToSMC) onNavigateToSMC(sym);
  };

  const subTabs: { id: SubTab; label: string; icon: React.FC<any>; count?: number }[] = [
    { id: "gainers", label: "?? Gainers", icon: TrendingUp, count: gainers.length },
    { id: "losers", label: "?? Losers", icon: TrendingDown, count: losers.length },
    { id: "most-active", label: "?? Most Active", icon: Flame, count: mostActiveVol.length },
    { id: "etfs", label: "?? ETFs", icon: BarChart2, count: etfs.length },
    { id: "top-performers", label: "?? Top Performers", icon: Award, count: topPerformers.length },
    { id: "all-stocks", label: "?? All NSE Stocks", icon: Database },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#ff6b35,#f7931e)", boxShadow: "0 0 20px rgba(255,107,53,0.25)" }}>
            <IndianRupee className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">India Market Hub</h2>
            <p className="text-[10px] text-slate-500">Live Data · {source}</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: marketOpen ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${marketOpen ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}` }}>
            <span className={`w-1.5 h-1.5 rounded-full ${marketOpen ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            <span className={`text-[10px] font-bold ${marketOpen ? "text-emerald-400" : "text-red-400"}`}>
              NSE {marketOpen ? "OPEN" : "CLOSED"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <Clock className="w-3 h-3" />
              {lastRefresh.toLocaleTimeString()} · next in {countdown}s
            </div>
          )}
          <button onClick={refreshAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer hover:scale-105"
            style={{ background: "rgba(6,182,212,0.1)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.2)" }}>
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      {/* Index Ticker */}
      {indices.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {indices.map(idx => (
            <div key={idx.symbol} className="shrink-0 px-4 py-2.5 rounded-xl flex flex-col gap-0.5 min-w-[140px]"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-[10px] font-bold text-slate-400">{idx.name}</span>
              <span className="text-sm font-black text-white font-mono">
                {idx.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </span>
              <PctBadge val={idx.changePct} />
            </div>
          ))}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {subTabs.map(t => {
          const active = subTab === t.id;
          return (
            <button key={t.id} onClick={() => setSubTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-all`}
              style={active
                ? { background: "rgba(255,107,53,0.1)", color: "#ff6b35", border: "1px solid rgba(255,107,53,0.2)" }
                : { color: "#64748b" }}>
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black"
                  style={{ background: active ? "rgba(255,107,53,0.2)" : "rgba(255,255,255,0.06)", color: active ? "#ff6b35" : "#64748b" }}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="rounded-xl p-4" style={{ background: "rgba(10,13,20,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {subTab === "gainers" && <StockTable stocks={gainers} loading={loading.gainers} onAnalyze={handleAnalyze} emptyMsg="No gainers data. NSE may be closed or rate-limited." />}
        {subTab === "losers" && <StockTable stocks={losers} loading={loading.losers} onAnalyze={handleAnalyze} emptyMsg="No losers data. NSE may be closed or rate-limited." />}
        {subTab === "most-active" && (
          <div>
            <div className="flex gap-2 mb-4">
              {(["volume", "value"] as const).map(v => (
                <button key={v} onClick={() => setActiveVolTab(v)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer capitalize"
                  style={activeVolTab === v
                    ? { background: "rgba(255,107,53,0.1)", color: "#ff6b35", border: "1px solid rgba(255,107,53,0.2)" }
                    : { background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid rgba(255,255,255,0.06)" }}>
                  By {v}
                </button>
              ))}
            </div>
            <StockTable stocks={activeVolTab === "volume" ? mostActiveVol : mostActiveVal}
              loading={loading["most-active"]} onAnalyze={handleAnalyze} emptyMsg="No most-active data." />
          </div>
        )}
        {subTab === "etfs" && <StockTable stocks={etfs} loading={loading.etfs} onAnalyze={handleAnalyze} emptyMsg="No ETF data. Yahoo Finance screener may be slow." />}
        {subTab === "top-performers" && <StockTable stocks={topPerformers} loading={loading["top-performers"]} onAnalyze={handleAnalyze} emptyMsg="No top performers data." />}
        {subTab === "all-stocks" && <AllStocksTab onAnalyze={handleAnalyze} />}
      </div>

      <p className="text-[10px] text-slate-700 text-center">
        Sourced from NSE India Official API + Yahoo Finance · Click <strong className="text-slate-600">Analyze</strong> on any stock ? opens SMC Report with live prices
      </p>
    </div>
  );
}
