import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  TrendingUp, TrendingDown, Activity, Search, RefreshCw,
  BarChart2, IndianRupee, ChevronUp, ChevronDown,
  Clock, Database, Flame, Award, Target
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
  sector?: string;
}

interface NiftyIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
}

type SubTab = "gainers" | "losers" | "most-active" | "etfs" | "top-performers" | "all-stocks";

function fmtPrice(n: number) {
  if (!n) return "—";
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtVol(n: number) {
  if (!n) return "—";
  if (n >= 10_000_000) return (n / 10_000_000).toFixed(2) + " Cr";
  if (n >= 100_000) return (n / 100_000).toFixed(2) + " L";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + " K";
  return n.toLocaleString();
}

function PctBadge({ val }: { val: number }) {
  const isPos = val >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold font-mono ${
        isPos ? "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20" : "text-red-400 bg-red-400/10 border border-red-400/20"
      }`}
    >
      {isPos ? "+" : ""}{val.toFixed(2)}%
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
                {th("change", "Chg (₹)")}
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
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer opacity-100 md:opacity-0 md:group-hover:opacity-100"
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

  const handleSearch = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const d = await fetch(`/api/india/search?q=${encodeURIComponent(q)}`).then(r => r.json());
        setResults(d.results || []);
      } catch {}
      setLoading(false);
    }, 300);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={query} onChange={e => handleSearch(e.target.value)}
          placeholder="Search 2,077+ NSE stocks by name or symbol (e.g. TATAMOTORS, INFY, RELIANCE, ZOMATO)…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs text-white outline-none placeholder-slate-600 focus:ring-1 focus:ring-cyan-500/40"
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
      setEtfs(d.stocks || []);
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
    { id: "gainers", label: "Gainers", icon: TrendingUp, count: gainers.length },
    { id: "losers", label: "Losers", icon: TrendingDown, count: losers.length },
    { id: "most-active", label: "Most Active", icon: Flame, count: mostActiveVol.length },
    { id: "etfs", label: "ETFs", icon: BarChart2, count: etfs.length },
    { id: "top-performers", label: "Top Performers", icon: Award, count: topPerformers.length },
    { id: "all-stocks", label: "All NSE Stocks", icon: Database },
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
            <span className="text-[10px] font-bold" style={{ color: marketOpen ? "#10b981" : "#ef4444" }}>
              {marketOpen ? "NSE LIVE" : "NSE CLOSED"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-600 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Auto-refresh in {countdown}s
          </span>
          <button onClick={refreshAll}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer"
            style={{ background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid rgba(255,255,255,0.08)" }}>
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      {/* Indices Ticker */}
      {indices.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {indices.map(idx => {
            const isPos = idx.changePct >= 0;
            return (
              <div key={idx.symbol} className="rounded-xl p-3.5"
                style={{ background: "rgba(10,13,20,0.8)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{idx.name}</div>
                <div className="text-base font-black font-mono text-white mt-0.5">{fmtPrice(idx.price)}</div>
                <div className={`text-[11px] font-bold font-mono mt-0.5 ${isPos ? "text-emerald-400" : "text-red-400"}`}>
                  {isPos ? "▲ +" : "▼ "}{idx.change.toFixed(2)} ({isPos ? "+" : ""}{idx.changePct.toFixed(2)}%)
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {subTabs.map(t => {
          const Icon = t.icon;
          const isActive = subTab === t.id;
          return (
            <button key={t.id} onClick={() => setSubTab(t.id)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all"
              style={isActive
                ? { background: "rgba(255,107,53,0.15)", color: "#ff6b35", border: "1px solid rgba(255,107,53,0.3)" }
                : { background: "transparent", color: "#64748b" }}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {t.count !== undefined && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono"
                  style={{ background: isActive ? "rgba(255,107,53,0.3)" : "rgba(255,255,255,0.06)", color: isActive ? "#ff6b35" : "#64748b" }}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {subTab === "gainers" && (
        <StockTable stocks={gainers} onAnalyze={handleAnalyze} loading={loading.gainers} emptyMsg="No gainers data available right now." />
      )}
      {subTab === "losers" && (
        <StockTable stocks={losers} onAnalyze={handleAnalyze} loading={loading.losers} emptyMsg="No losers data available right now." />
      )}
      {subTab === "most-active" && (
        <div>
          <div className="flex gap-2 mb-3">
            <button onClick={() => setActiveVolTab("volume")}
              className="px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer"
              style={activeVolTab === "volume"
                ? { background: "rgba(6,182,212,0.15)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.3)" }
                : { background: "rgba(255,255,255,0.03)", color: "#64748b" }}>
              By Volume (Shares)
            </button>
            <button onClick={() => setActiveVolTab("value")}
              className="px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer"
              style={activeVolTab === "value"
                ? { background: "rgba(6,182,212,0.15)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.3)" }
                : { background: "rgba(255,255,255,0.03)", color: "#64748b" }}>
              By Turnover Value (₹)
            </button>
          </div>
          <StockTable
            stocks={activeVolTab === "volume" ? mostActiveVol : mostActiveVal}
            onAnalyze={handleAnalyze}
            loading={loading["most-active"]}
            emptyMsg="No active stocks data right now."
          />
        </div>
      )}
      {subTab === "etfs" && (
        <StockTable stocks={etfs} onAnalyze={handleAnalyze} loading={loading.etfs} emptyMsg="No ETF data available." />
      )}
      {subTab === "top-performers" && (
        <StockTable stocks={topPerformers} onAnalyze={handleAnalyze} loading={loading["top-performers"]} emptyMsg="No 52-week top performers available." />
      )}
      {subTab === "all-stocks" && (
        <AllStocksTab onAnalyze={handleAnalyze} />
      )}
    </div>
  );
}
