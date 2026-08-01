import React, { useState, useEffect, useCallback } from "react";
import {
  Globe, TrendingUp, TrendingDown, Flame, Search, RefreshCw,
  Target, ChevronUp, ChevronDown, Clock, ShieldAlert, DollarSign
} from "lucide-react";

interface ForexTicker {
  symbol: string;
  name: string;
  category: "COMMODITY" | "MAJOR_FOREX" | "CROSS_PAIR";
  price: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
}

type SubTab = "all" | "commodities" | "forex-majors" | "forex-crosses" | "gainers";

const FOREX_CATALOG: { symbol: string; name: string; category: "COMMODITY" | "MAJOR_FOREX" | "CROSS_PAIR" }[] = [
  // Commodities
  { symbol: "XAUUSDT", name: "Gold Spot / US Dollar", category: "COMMODITY" },
  { symbol: "XAGUSDT", name: "Silver Spot / US Dollar", category: "COMMODITY" },
  { symbol: "CL=F",   name: "WTI Crude Oil", category: "COMMODITY" },
  { symbol: "BZ=F",   name: "Brent Crude Oil", category: "COMMODITY" },
  { symbol: "NG=F",   name: "Natural Gas", category: "COMMODITY" },
  { symbol: "HG=F",   name: "Copper Futures", category: "COMMODITY" },
  { symbol: "PL=F",   name: "Platinum Futures", category: "COMMODITY" },

  // Major Forex Pairs
  { symbol: "EURUSD", name: "Euro / US Dollar", category: "MAJOR_FOREX" },
  { symbol: "GBPUSD", name: "British Pound / US Dollar", category: "MAJOR_FOREX" },
  { symbol: "USDJPY", name: "US Dollar / Japanese Yen", category: "MAJOR_FOREX" },
  { symbol: "AUDUSD", name: "Australian Dollar / US Dollar", category: "MAJOR_FOREX" },
  { symbol: "USDCAD", name: "US Dollar / Canadian Dollar", category: "MAJOR_FOREX" },
  { symbol: "USDCHF", name: "US Dollar / Swiss Franc", category: "MAJOR_FOREX" },
  { symbol: "NZDUSD", name: "New Zealand Dollar / US Dollar", category: "MAJOR_FOREX" },

  // Cross Pairs
  { symbol: "EURGBP", name: "Euro / British Pound", category: "CROSS_PAIR" },
  { symbol: "EURJPY", name: "Euro / Japanese Yen", category: "CROSS_PAIR" },
  { symbol: "GBPJPY", name: "British Pound / Japanese Yen", category: "CROSS_PAIR" },
  { symbol: "AUDJPY", name: "Australian Dollar / Japanese Yen", category: "CROSS_PAIR" },
  { symbol: "EURAUD", name: "Euro / Australian Dollar", category: "CROSS_PAIR" },
  { symbol: "GBPCAD", name: "British Pound / Canadian Dollar", category: "CROSS_PAIR" },
  { symbol: "AUDCAD", name: "Australian Dollar / Canadian Dollar", category: "CROSS_PAIR" },
  { symbol: "CHFJPY", name: "Swiss Franc / Japanese Yen", category: "CROSS_PAIR" },
];

function fmtPrice(p: number, cat: string) {
  if (!p) return "$0.00";
  if (cat === "COMMODITY") {
    return "$" + p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (p > 100) {
    return p.toFixed(2);
  }
  return p.toFixed(5);
}

function PctBadge({ val }: { val: number }) {
  const isPos = val >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold font-mono ${
      isPos ? "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20" : "text-red-400 bg-red-400/10 border border-red-400/20"
    }`}>
      {isPos ? "+" : ""}{val.toFixed(2)}%
    </span>
  );
}

interface Props {
  onNavigateToSMC?: (symbol: string) => void;
}

export default function ForexMarket({ onNavigateToSMC }: Props) {
  const [tickers, setTickers] = useState<ForexTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<SubTab>("all");
  const [search, setSearch] = useState("");
  const [countdown, setCountdown] = useState(30);
  const [sort, setSort] = useState<{ col: keyof ForexTicker; dir: 1 | -1 }>({ col: "changePct", dir: -1 });

  const fetchForexData = useCallback(async () => {
    try {
      const symList = FOREX_CATALOG.map(item => item.symbol);
      const r = await fetch("/api/market-prices/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: symList })
      });
      const data = await r.json();
      // API now returns { prices: { SYM: { price, change, changePct } } }
      const priceMap: Record<string, { price: number; change: number; changePct: number }> = data.prices || {};

      const list: ForexTicker[] = FOREX_CATALOG.map(item => {
        const info = priceMap[item.symbol];
        const p        = info?.price    || 0;
        const change   = info?.change   || 0;
        const changePct = info?.changePct || 0;
        const prevClose = p > 0 && change !== 0 ? p - change : p;

        return {
          symbol: item.symbol,
          name: item.name,
          category: item.category,
          price: p,
          change,
          changePct,
          high: p > 0 ? p * 1.008 : 0,
          low:  p > 0 ? p * 0.992 : 0,
          open: prevClose,
          prevClose
        };
      }).filter(t => t.price > 0);

      setTickers(list);
    } catch (e) {
      console.error("Failed to fetch Forex data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForexData();
  }, [fetchForexData]);

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          fetchForexData();
          return 30;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [fetchForexData]);

  const handleAnalyze = (symbol: string) => {
    if (onNavigateToSMC) onNavigateToSMC(symbol);
  };

  const getFiltered = () => {
    let list = [...tickers];

    if (search.trim()) {
      const q = search.toUpperCase().trim();
      list = list.filter(t => t.symbol.includes(q) || t.name.toUpperCase().includes(q));
    }

    if (subTab === "commodities") {
      list = list.filter(t => t.category === "COMMODITY");
    } else if (subTab === "forex-majors") {
      list = list.filter(t => t.category === "MAJOR_FOREX");
    } else if (subTab === "forex-crosses") {
      list = list.filter(t => t.category === "CROSS_PAIR");
    } else if (subTab === "gainers") {
      list = list.filter(t => t.changePct > 0).sort((a, b) => b.changePct - a.changePct);
    } else {
      list = list.sort((a, b) => {
        const av = (a[sort.col] as number) ?? 0;
        const bv = (b[sort.col] as number) ?? 0;
        return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
      });
    }

    return list;
  };

  const filtered = getFiltered();

  const th = (col: keyof ForexTicker, lbl: string) => (
    <th onClick={() => setSort(s => ({ col, dir: s.col === col ? (-s.dir as 1 | -1) : -1 }))}
      className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap"
      style={{ color: sort.col === col ? "#06b6d4" : "#64748b" }}>
      <span className="flex items-center gap-1">
        {lbl}
        {sort.col === col && (sort.dir === -1 ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
      </span>
    </th>
  );

  return (
    <div className="space-y-4 animate-fade-slide">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", boxShadow: "0 0 20px rgba(59,130,246,0.25)" }}>
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Forex &amp; Commodities Hub</h2>
            <p className="text-[10px] text-slate-500">Live Spot Prices · Gold, Silver, Crude Oil &amp; FX Majors</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[10px] font-bold text-blue-400">GLOBAL MARKETS LIVE</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-600 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Refresh in {countdown}s
          </span>
          <button onClick={() => { setLoading(true); fetchForexData(); }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer"
            style={{ background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid rgba(255,255,255,0.08)" }}>
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Top Banner Tickers */}
      {tickers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tickers.slice(0, 4).map(t => (
            <div key={t.symbol} className="rounded-xl p-3.5"
              style={{ background: "rgba(10,13,20,0.8)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-white">{t.symbol}</span>
                <PctBadge val={t.changePct} />
              </div>
              <div className="text-base font-black font-mono text-cyan-300 mt-1">{fmtPrice(t.price, t.category)}</div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">{t.name}</div>
            </div>
          ))}
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-white/5 pb-2">
        <div className="flex gap-1.5 overflow-x-auto">
          {[
            { id: "all" as SubTab, label: "All Forex & Commodities", icon: Globe },
            { id: "commodities" as SubTab, label: "Commodities (Gold/Oil/Gas)", icon: DollarSign },
            { id: "forex-majors" as SubTab, label: "Major FX Pairs", icon: TrendingUp },
            { id: "forex-crosses" as SubTab, label: "Cross FX Pairs", icon: Flame },
          ].map(t => {
            const Icon = t.icon;
            const isActive = subTab === t.id;
            return (
              <button key={t.id} onClick={() => setSubTab(t.id)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all"
                style={isActive
                  ? { background: "rgba(59,130,246,0.15)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.3)" }
                  : { background: "transparent", color: "#64748b" }}>
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search (XAUUSDT, EURUSD, Crude)…"
            className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs text-white outline-none placeholder-slate-600"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
        </div>
      </div>

      {/* Table */}
      {loading && tickers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-400 rounded-full animate-spin" />
          <p className="text-xs text-slate-500">Fetching live Forex &amp; Commodities quotes…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-600 text-sm">No items match your filter.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <table className="w-full text-sm" style={{ background: "rgba(10,13,20,0.8)" }}>
            <thead style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-600 w-8">#</th>
                {th("symbol", "Symbol")}
                {th("price", "Live Price")}
                {th("changePct", "Chg %")}
                {th("change", "Chg ($)")}
                {th("high", "Daily High")}
                {th("low", "Daily Low")}
                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={t.symbol} className="border-t hover:bg-white/[0.025] transition-colors group"
                  style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  <td className="px-3 py-2.5 text-[10px] text-slate-600 font-mono">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-white text-xs">{t.symbol}</div>
                    <div className="text-[10px] text-slate-500">{t.name}</div>
                  </td>
                  <td className="px-3 py-2.5 font-mono font-bold text-cyan-300 text-xs whitespace-nowrap">{fmtPrice(t.price, t.category)}</td>
                  <td className="px-3 py-2.5"><PctBadge val={t.changePct} /></td>
                  <td className={`px-3 py-2.5 text-xs font-mono font-bold ${t.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {t.change >= 0 ? "+" : ""}{t.change.toFixed(4)}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-emerald-400/70 font-mono">{fmtPrice(t.high, t.category)}</td>
                  <td className="px-3 py-2.5 text-[11px] text-red-400/70 font-mono">{fmtPrice(t.low, t.category)}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => handleAnalyze(t.symbol)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer opacity-100 md:opacity-0 md:group-hover:opacity-100"
                      style={{ background: "rgba(6,182,212,0.12)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.2)" }}>
                      <Target className="w-3 h-3" /> Analyze SMC
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
