import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Flame, Search, RefreshCw,
  Coins, Target, ChevronUp, ChevronDown, Clock, Zap
} from "lucide-react";

interface CryptoTicker {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  quoteVolume: number;
}

type SubTab = "gainers" | "losers" | "volume" | "all";

const POPULAR_CRYPTO_LIST = [
  { symbol: "BTCUSDT", name: "Bitcoin" },
  { symbol: "ETHUSDT", name: "Ethereum" },
  { symbol: "SOLUSDT", name: "Solana" },
  { symbol: "BNBUSDT", name: "BNB" },
  { symbol: "XRPUSDT", name: "XRP" },
  { symbol: "DOGEUSDT", name: "Dogecoin" },
  { symbol: "ADAUSDT", name: "Cardano" },
  { symbol: "AVAXUSDT", name: "Avalanche" },
  { symbol: "LINKUSDT", name: "Chainlink" },
  { symbol: "DOTUSDT", name: "Polkadot" },
  { symbol: "NEARUSDT", name: "NEAR Protocol" },
  { symbol: "SHIBUSDT", name: "Shiba Inu" },
  { symbol: "PEPEUSDT", name: "Pepe" },
  { symbol: "SUIUSDT", name: "Sui" },
  { symbol: "UNIUSDT", name: "Uniswap" },
  { symbol: "TRXUSDT", name: "TRON" },
  { symbol: "LTCUSDT", name: "Litecoin" },
  { symbol: "FETUSDT", name: "Artificial Superintelligence Alliance" },
  { symbol: "RENDERUSDT", name: "Render" },
  { symbol: "TAOUSDT", name: "Bittensor" },
  { symbol: "WIFUSDT", name: "dogwifhat" },
  { symbol: "INJUSDT", name: "Injective" },
  { symbol: "ARBUSDT", name: "Arbitrum" },
  { symbol: "OPUSDT", name: "Optimism" },
  { symbol: "APTUSDT", name: "Aptos" },
  { symbol: "SEIUSDT", name: "Sei" },
  { symbol: "TIAUSDT", name: "Celestia" },
  { symbol: "FLOKIUSDT", name: "Floki" },
  { symbol: "BONKUSDT", name: "Bonk" },
  { symbol: "KASUSDT", name: "Kaspa" }
];

function fmtPrice(p: number) {
  if (!p) return "$0.00";
  if (p < 0.0001) return "$" + p.toFixed(8);
  if (p < 0.01) return "$" + p.toFixed(6);
  if (p < 1) return "$" + p.toFixed(4);
  return "$" + p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtVol(v: number) {
  if (!v) return "—";
  if (v >= 1_000_000_000) return "$" + (v / 1_000_000_000).toFixed(2) + " B";
  if (v >= 1_000_000) return "$" + (v / 1_000_000).toFixed(2) + " M";
  if (v >= 1_000) return "$" + (v / 1_000).toFixed(1) + " K";
  return "$" + v.toLocaleString();
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

export default function CryptoMarket({ onNavigateToSMC }: Props) {
  const [tickers, setTickers] = useState<CryptoTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<SubTab>("gainers");
  const [search, setSearch] = useState("");
  const [countdown, setCountdown] = useState(15);
  const [sort, setSort] = useState<{ col: keyof CryptoTicker; dir: 1 | -1 }>({ col: "changePct", dir: -1 });

  const fetchBinanceTickers = useCallback(async () => {
    try {
      const r = await fetch("https://api.binance.com/api/v3/ticker/24hr");
      const data = await r.json();
      const nameMap = new Map(POPULAR_CRYPTO_LIST.map(c => [c.symbol, c.name]));
      
      const parsed: CryptoTicker[] = Array.isArray(data) ? data
        .filter((t: any) => t.symbol.endsWith("USDT") && (nameMap.has(t.symbol) || parseFloat(t.quoteVolume) > 10_000_000))
        .map((t: any) => {
          const price = parseFloat(t.lastPrice);
          const change = parseFloat(t.priceChange);
          const changePct = parseFloat(t.priceChangePercent);
          const high24h = parseFloat(t.highPrice);
          const low24h = parseFloat(t.lowPrice);
          const quoteVolume = parseFloat(t.quoteVolume);
          const volume24h = parseFloat(t.volume);

          return {
            symbol: t.symbol,
            name: nameMap.get(t.symbol) || t.symbol.replace("USDT", " / USDT"),
            price,
            change,
            changePct,
            high24h,
            low24h,
            quoteVolume,
            volume24h
          };
        }) : [];

      setTickers(parsed);
    } catch (e) {
      console.error("Failed to fetch Binance tickers", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBinanceTickers();
  }, [fetchBinanceTickers]);

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          fetchBinanceTickers();
          return 15;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [fetchBinanceTickers]);

  const handleAnalyze = (symbol: string) => {
    if (onNavigateToSMC) onNavigateToSMC(symbol);
  };

  const getFiltered = () => {
    let list = [...tickers];

    if (search.trim()) {
      const q = search.toUpperCase().trim();
      list = list.filter(t => t.symbol.includes(q) || t.name.toUpperCase().includes(q));
    }

    if (subTab === "gainers") {
      list = list.filter(t => t.changePct > 0).sort((a, b) => b.changePct - a.changePct);
    } else if (subTab === "losers") {
      list = list.filter(t => t.changePct < 0).sort((a, b) => a.changePct - b.changePct);
    } else if (subTab === "volume") {
      list = list.sort((a, b) => b.quoteVolume - a.quoteVolume);
    } else {
      // sort by selected column
      list = list.sort((a, b) => {
        const av = (a[sort.col] as number) ?? 0;
        const bv = (b[sort.col] as number) ?? 0;
        return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
      });
    }

    return list;
  };

  const filtered = getFiltered();

  const th = (col: keyof CryptoTicker, lbl: string) => (
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
            style={{ background: "linear-gradient(135deg,#f7931a,#ffb900)", boxShadow: "0 0 20px rgba(247,147,26,0.25)" }}>
            <Coins className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Crypto Market Hub</h2>
            <p className="text-[10px] text-slate-500">Live Binance 24h Ticker · Real-Time Spot &amp; Futures Pairs</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] font-bold text-amber-400">BINANCE LIVE</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-600 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Refresh in {countdown}s
          </span>
          <button onClick={() => { setLoading(true); fetchBinanceTickers(); }}
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
              <div className="text-base font-black font-mono text-cyan-300 mt-1">{fmtPrice(t.price)}</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">24h Vol: {fmtVol(t.quoteVolume)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-white/5 pb-2">
        <div className="flex gap-1.5 overflow-x-auto">
          {[
            { id: "gainers" as SubTab, label: "Top Gainers", icon: TrendingUp },
            { id: "losers" as SubTab, label: "Top Losers", icon: TrendingDown },
            { id: "volume" as SubTab, label: "24h Volume Leaders", icon: Flame },
            { id: "all" as SubTab, label: "All Crypto Pairs", icon: Zap },
          ].map(t => {
            const Icon = t.icon;
            const isActive = subTab === t.id;
            return (
              <button key={t.id} onClick={() => setSubTab(t.id)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all"
                style={isActive
                  ? { background: "rgba(247,147,26,0.15)", color: "#f7931a", border: "1px solid rgba(247,147,26,0.3)" }
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
            placeholder="Search crypto (BTC, SOL, PEPE)…"
            className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs text-white outline-none placeholder-slate-600"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
        </div>
      </div>

      {/* Tickers Table */}
      {loading && tickers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
          <p className="text-xs text-slate-500">Connecting to Binance Live Ticker Stream…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-600 text-sm">No Crypto pairs found matching your search.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <table className="w-full text-sm" style={{ background: "rgba(10,13,20,0.8)" }}>
            <thead style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-600 w-8">#</th>
                {th("symbol", "Pair")}
                {th("price", "Price ($)")}
                {th("changePct", "24h Chg %")}
                {th("change", "24h Chg ($)")}
                {th("quoteVolume", "24h Volume")}
                {th("high24h", "24h High")}
                {th("low24h", "24h Low")}
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
                  <td className="px-3 py-2.5 font-mono font-bold text-cyan-300 text-xs whitespace-nowrap">{fmtPrice(t.price)}</td>
                  <td className="px-3 py-2.5"><PctBadge val={t.changePct} /></td>
                  <td className={`px-3 py-2.5 text-xs font-mono font-bold ${t.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {t.change >= 0 ? "+" : ""}{t.change < 0.01 && t.change > -0.01 ? t.change.toFixed(6) : t.change.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-300 font-mono">{fmtVol(t.quoteVolume)}</td>
                  <td className="px-3 py-2.5 text-[11px] text-emerald-400/70 font-mono">{fmtPrice(t.high24h)}</td>
                  <td className="px-3 py-2.5 text-[11px] text-red-400/70 font-mono">{fmtPrice(t.low24h)}</td>
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
