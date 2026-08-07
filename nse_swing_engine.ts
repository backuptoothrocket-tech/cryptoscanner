// ═══════════════════════════════════════════════════════════════════════════════
// NSE INSTITUTIONAL SWING RESEARCH ENGINE
// Multi-Source · 100-Point Score · AI Ranking · Nightly Telegram Alerts
// ═══════════════════════════════════════════════════════════════════════════════

import express from "express";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NSESwingSignal {
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

export interface NSEMarketRegime {
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

export interface NSESectorScore {
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

export interface NSEScanResult {
  runAt: string;
  duration: number;
  totalScanned: number;
  sectorScores: NSESectorScore[];
  marketRegime: NSEMarketRegime;
  topCandidates: { symbol: string; name: string; sector: string; score: number; price: number }[];
  signals: NSESwingSignal[];
  noSignalReason?: string;
}

export interface NSEMorningSignalStatus {
  symbol: string;
  name: string;
  nightlySignal: NSESwingSignal;
  livePrice945: number;
  gapPct: number;
  status: "CONFIRMED_IN_ZONE" | "GAP_UP_WAIT" | "GAP_DOWN_HOLD" | "INVALIDATED_BELOW_SL" | "T1_REACHED_SKIP";
  actionText: string;
}

export interface NSEMorningScanResult {
  runAt: string;
  marketRegime945: NSEMarketRegime;
  signalStatuses: NSEMorningSignalStatus[];
  changeOfPlan: boolean;
  changeOfPlanReason: string;
}

// ─── In-memory state ──────────────────────────────────────────────────────────

let lastResult: NSEScanResult | null = null;
let lastMorningResult: NSEMorningScanResult | null = null;
let scanHistory: { runAt: string; signals: number; scanned: number }[] = [];
let scanRunning = false;
let marketCache: { data: NSEMarketRegime; expiry: number } | null = null;
let sectorCache: { data: NSESectorScore[]; expiry: number } | null = null;

// ─── NSE request helper (injected from main server) ───────────────────────────

type NseGetFn = (path: string) => Promise<any>;
type SendTgFn = (token: string, chatId: string, msg: string, proxy?: string, trade?: any, db?: any) => Promise<any>;
type GetLivePricesFn = (syms: string[]) => Promise<Record<string, { price: number; change: number; changePct: number }>>;
type ReadDbFn = () => Promise<any>;

let _nseGet: NseGetFn;
let _sendTg: SendTgFn;
let _getLivePrices: GetLivePricesFn;
let _readDb: ReadDbFn;
let _catalog: { symbol: string; name: string; sector: string }[];
let _calcEMA: (prices: number[], period: number) => number;
let _calcRSI: (prices: number[], period?: number) => number;
let _calcMACD: (prices: number[]) => { macd: number; signal: number; histogram: number; cross: "bullish_cross" | "bearish_cross" | "neutral" };
let _calcATR: (highs: number[], lows: number[], closes: number[], period?: number) => number;
let _calcADX: (highs: number[], lows: number[], closes: number[], period?: number) => number;
let _calcOBV: (closes: number[], volumes: number[]) => "rising" | "falling" | "flat";
let _detectMS: (highs: number[], lows: number[], closes: number[]) => "BOS" | "CHOCH" | "";

const NSE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function initNSESwingEngine(deps: {
  nseGet: NseGetFn;
  sendTelegramNotification: SendTgFn;
  getLivePricesBatch: GetLivePricesFn;
  readDB: ReadDbFn;
  catalog: { symbol: string; name: string; sector: string }[];
  calculateLatestEMA: (prices: number[], period: number) => number;
  calculateLatestRSI: (prices: number[], period?: number) => number;
  calculateLatestMACD: (prices: number[]) => any;
  calculateATR: (highs: number[], lows: number[], closes: number[], period?: number) => number;
  calculateADX: (highs: number[], lows: number[], closes: number[], period?: number) => number;
  calculateOBVTrend: (closes: number[], volumes: number[]) => "rising" | "falling" | "flat";
  detectMarketStructure: (highs: number[], lows: number[], closes: number[]) => "BOS" | "CHOCH" | "";
}) {
  _nseGet        = deps.nseGet;
  _sendTg        = deps.sendTelegramNotification;
  _getLivePrices = deps.getLivePricesBatch;
  _readDb        = deps.readDB;
  _catalog       = deps.catalog;
  _calcEMA       = deps.calculateLatestEMA;
  _calcRSI       = deps.calculateLatestRSI;
  _calcMACD      = deps.calculateLatestMACD;
  _calcATR       = deps.calculateATR;
  _calcADX       = deps.calculateADX;
  _calcOBV       = deps.calculateOBVTrend;
  _detectMS      = deps.detectMarketStructure;
}

// ─── LAYER 1: DATA COLLECTION ─────────────────────────────────────────────────

async function fetchYahooDailyCandles(symbol: string, days = 250): Promise<{
  timestamps: number[]; opens: number[]; highs: number[];
  lows: number[]; closes: number[]; volumes: number[];
}> {
  const empty = { timestamps: [], opens: [], highs: [], lows: [], closes: [], volumes: [] };
  try {
    const range = days <= 60 ? "3mo" : days <= 125 ? "6mo" : "1y";
    const urls = [
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`,
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`,
    ];
    for (const url of urls) {
      try {
        const r = await fetch(url, {
          headers: { "User-Agent": NSE_UA, "Accept": "application/json" },
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) continue;
        const d = await r.json();
        const result = d?.chart?.result?.[0];
        if (!result?.timestamp) continue;
        const q = result.indicators?.quote?.[0] || {};
        const t: number[] = result.timestamp;
        const c: number[] = q.close  || [];
        const h: number[] = q.high   || [];
        const l: number[] = q.low    || [];
        const o: number[] = q.open   || [];
        const v: number[] = q.volume || [];
        const idx = t.map((_: any, i: number) => i).filter((i: number) => c[i] != null && !isNaN(c[i]));
        return {
          timestamps: idx.map((i: number) => t[i]),
          opens:      idx.map((i: number) => o[i] || c[i]),
          highs:      idx.map((i: number) => h[i] || c[i]),
          lows:       idx.map((i: number) => l[i] || c[i]),
          closes:     idx.map((i: number) => c[i]),
          volumes:    idx.map((i: number) => v[i] || 0),
        };
      } catch {}
    }
  } catch {}
  return empty;
}

async function fetchNSEBhavcopy(): Promise<Record<string, {
  open: number; high: number; low: number; close: number;
  volume: number; deliveryPct: number; yearHigh: number; yearLow: number;
}>> {
  const map: Record<string, any> = {};
  try {
    const data = await _nseGet("/api/bhavcopyequity");
    const rows: any[] = Array.isArray(data) ? data : (data?.data || []);
    for (const r of rows) {
      const sym = (r.SYMBOL || r.symbol || "").toUpperCase();
      if (!sym || (r.SERIES || r.series) !== "EQ") continue;
      map[sym] = {
        open: parseFloat(r.OPEN || r.open || 0),
        high: parseFloat(r.HIGH || r.high || 0),
        low:  parseFloat(r.LOW  || r.low  || 0),
        close: parseFloat(r.CLOSE || r.close || 0),
        volume: parseFloat(r.TOTTRDQTY || r.totalTradedVolume || 0),
        deliveryPct: parseFloat(r.DELIV_PER || 0),
        yearHigh: parseFloat(r["52W_H"] || 0),
        yearLow:  parseFloat(r["52W_L"] || 0),
      };
    }
  } catch {}
  return map;
}

async function fetchNSECorporateActions(): Promise<Record<string, string[]>> {
  const catMap: Record<string, string[]> = {};
  const add = (sym: string, msg: string) => {
    const s = sym.toUpperCase().replace(".NS", "");
    catMap[s] = catMap[s] || [];
    catMap[s].push(msg);
  };
  try {
    const [bulk, block, events] = await Promise.allSettled([
      _nseGet("/api/corporates-bulkdeals"),
      _nseGet("/api/corporates-blockdeals"),
      _nseGet("/api/event-calendar"),
    ]);
    if (bulk.status === "fulfilled") {
      const rows: any[] = Array.isArray(bulk.value) ? bulk.value : (bulk.value?.data || []);
      for (const r of rows)
        if ((r.buySell || "").toUpperCase() === "BUY")
          add(r.symbol || "", `Bulk Deal BUY by ${r.clientName || "institution"}`);
    }
    if (block.status === "fulfilled") {
      const rows: any[] = Array.isArray(block.value) ? block.value : (block.value?.data || []);
      for (const r of rows)
        add(r.symbol || "", `Block Deal: ${r.quantity || ""} shares @ ₹${r.tradePrice || ""}`);
    }
    if (events.status === "fulfilled") {
      const rows: any[] = Array.isArray(events.value) ? events.value : (events.value?.data || []);
      for (const r of rows) {
        const p = (r.purpose || "").toLowerCase();
        if (p.includes("result") || p.includes("dividend") || p.includes("bonus"))
          add(r.symbol || "", `Event: ${r.purpose}`);
      }
    }
  } catch {}
  return catMap;
}

async function fetchNSEShareholding(symbol: string): Promise<{
  fiiPct: number; diiPct: number; promoterPct: number;
  fiiQoQChange: number; diiQoQChange: number; instScore: number;
}> {
  const def = { fiiPct: 0, diiPct: 0, promoterPct: 0, fiiQoQChange: 0, diiQoQChange: 0, instScore: 3 };
  try {
    const sym = symbol.replace(".NS", "").toUpperCase();
    const data = await _nseGet(`/api/shareholding-patterns?symbol=${sym}&seriesCode=EQ`);
    const quarters: any[] = data?.data || data?.shareholdingPatterns || [];
    if (quarters.length < 2) return def;
    const fiiPct      = parseFloat(quarters[0]?.fii?.total_per || 0);
    const diiPct      = parseFloat(quarters[0]?.dii?.total_per || 0);
    const promoterPct = parseFloat(quarters[0]?.promoter?.total_per || 0);
    const fiiQoQ      = fiiPct - parseFloat(quarters[1]?.fii?.total_per || 0);
    const diiQoQ      = diiPct - parseFloat(quarters[1]?.dii?.total_per || 0);
    let instScore = 3;
    if (fiiQoQ > 2) instScore += 4; else if (fiiQoQ > 0.5) instScore += 2; else if (fiiQoQ < -2) instScore -= 2;
    if (diiQoQ > 1) instScore += 2; else if (diiQoQ > 0) instScore += 1;
    return { fiiPct, diiPct, promoterPct, fiiQoQChange: fiiQoQ, diiQoQChange: diiQoQ, instScore: Math.max(0, Math.min(10, instScore)) };
  } catch { return def; }
}

async function fetchYahooFundamentals(symbol: string): Promise<{
  pe: number; roe: number; roce: number; debtToEquity: number;
  profitMargin: number; revenueGrowth: number; earningsGrowth: number; fundScore: number;
}> {
  const def = { pe: 0, roe: 0, roce: 0, debtToEquity: 0, profitMargin: 0, revenueGrowth: 0, earningsGrowth: 0, fundScore: 2 };
  try {
    const urls = [
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=financialData,defaultKeyStatistics`,
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=financialData,defaultKeyStatistics`,
    ];
    for (const url of urls) {
      try {
        const r = await fetch(url, { headers: { "User-Agent": NSE_UA }, signal: AbortSignal.timeout(8000) });
        if (!r.ok) continue;
        const d = await r.json();
        const fd = d?.quoteSummary?.result?.[0]?.financialData;
        const ks = d?.quoteSummary?.result?.[0]?.defaultKeyStatistics;
        if (!fd) continue;
        const roe            = (parseFloat(fd?.returnOnEquity?.raw  || 0)) * 100;
        const roce           = (parseFloat(fd?.returnOnAssets?.raw  || 0)) * 100;
        const profitMargin   = (parseFloat(fd?.profitMargins?.raw   || 0)) * 100;
        const revenueGrowth  = (parseFloat(fd?.revenueGrowth?.raw   || 0)) * 100;
        const earningsGrowth = (parseFloat(fd?.earningsGrowth?.raw  || 0)) * 100;
        const debtToEquity   =  parseFloat(fd?.debtToEquity?.raw    || 0);
        const pe             =  parseFloat(ks?.trailingPE?.raw      || 0);
        let fundScore = 0;
        if (roe > 15) fundScore += 1.5; else if (roe > 10) fundScore += 0.8;
        if (earningsGrowth > 15) fundScore += 1.2; else if (earningsGrowth > 5) fundScore += 0.6;
        if (debtToEquity < 0.5) fundScore += 0.8; else if (debtToEquity > 2) fundScore -= 0.5;
        if (profitMargin > 15) fundScore += 0.5;
        return { pe, roe, roce, debtToEquity, profitMargin, revenueGrowth, earningsGrowth, fundScore: Math.max(0, Math.min(5, Math.round(fundScore * 10) / 10)) };
      } catch {}
    }
  } catch {}
  return def;
}

async function fetchNewsRSS(symbols: string[]): Promise<Record<string, { title: string; sentiment: "positive" | "negative" | "neutral"; source: string }[]>> {
  const out: Record<string, any[]> = {};
  const symSet = new Set(symbols.map(s => s.replace(".NS", "").toUpperCase()));
  const POS = ["buy","upgrade","outperform","profit","growth","record","wins","order","beat","surge","rally","acquisition","expansion","hike","strong"];
  const NEG = ["sell","downgrade","underperform","loss","decline","fraud","penalty","probe","crash","warning","default","cut","miss","below"];
  const senti = (t: string): "positive" | "negative" | "neutral" => {
    const lo = t.toLowerCase();
    const p = POS.filter(k => lo.includes(k)).length;
    const n = NEG.filter(k => lo.includes(k)).length;
    return p > n ? "positive" : n > p ? "negative" : "neutral";
  };
  await Promise.allSettled([
    { url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms", source: "ET" },
    { url: "https://www.moneycontrol.com/rss/business.xml", source: "Moneycontrol" },
  ].map(async ({ url, source }) => {
    try {
      const r = await fetch(url, { headers: { "User-Agent": NSE_UA }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) return;
      const xml = await r.text();
      for (const m of xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)) {
        const tm = m[1].match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
        if (!tm) continue;
        const title = tm[1].replace(/<[^>]+>/g, "").trim();
        for (const sym of symSet) {
          if (title.toUpperCase().includes(sym)) {
            out[sym] = out[sym] || [];
            out[sym].push({ title, sentiment: senti(title), source });
            break;
          }
        }
      }
    } catch {}
  }));
  return out;
}

// ─── LAYER 2: ANALYSIS ENGINE ─────────────────────────────────────────────────

export async function analyzeNSEMarketRegime(): Promise<NSEMarketRegime> {
  if (marketCache && Date.now() < marketCache.expiry) return marketCache.data;
  async function fetchIdx(sym: string) {
    const urls = [
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1y`,
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1y`,
    ];
    for (const url of urls) {
      try {
        const r = await fetch(url, { headers: { "User-Agent": NSE_UA }, signal: AbortSignal.timeout(10000) });
        if (!r.ok) continue;
        const d = await r.json();
        const res = d?.chart?.result?.[0];
        if (!res) continue;
        const c: number[] = (res.indicators?.quote?.[0]?.close || []).filter((x: any) => x != null && !isNaN(x));
        const price = res.meta?.regularMarketPrice || c[c.length - 1] || 0;
        const prev  = res.meta?.previousClose || res.meta?.chartPreviousClose || price;
        return { price, change: prev > 0 ? ((price - prev) / prev) * 100 : 0, closes: c };
      } catch {}
    }
    return { price: 0, change: 0, closes: [] as number[] };
  }
  const [nifty, bank, vixD] = await Promise.all([fetchIdx("^NSEI"), fetchIdx("^NSEBANK"), fetchIdx("^INDIAVIX")]);
  const ema20  = nifty.closes.length >= 20  ? _calcEMA(nifty.closes, 20)  : nifty.price;
  const ema50  = nifty.closes.length >= 50  ? _calcEMA(nifty.closes, 50)  : nifty.price;
  const ema200 = nifty.closes.length >= 200 ? _calcEMA(nifty.closes, 200) : nifty.price;
  const bEma20 = bank.closes.length >= 20   ? _calcEMA(bank.closes, 20)   : bank.price;
  const bEma50 = bank.closes.length >= 50   ? _calcEMA(bank.closes, 50)   : bank.price;
  const trend = (p: number, e20: number, e50: number): "bullish" | "bearish" | "neutral" =>
    p > e20 && e20 > e50 ? "bullish" : p < e20 && e20 < e50 ? "bearish" : "neutral";
  const nTrend = trend(nifty.price, ema20, ema50);
  const bTrend = trend(bank.price, bEma20, bEma50);
  const vix    = vixD.price || 15;
  const vixLevel: "low" | "moderate" | "high" = vix < 15 ? "low" : vix < 20 ? "moderate" : "high";
  let mScore = 5;
  if (nTrend === "bullish") mScore += 2; if (nTrend === "bearish") mScore -= 2;
  if (bTrend === "bullish") mScore += 1; if (bTrend === "bearish") mScore -= 1;
  if (vixLevel === "low") mScore += 2; if (vixLevel === "high") mScore -= 3;
  mScore = Math.max(0, Math.min(10, mScore));
  const regime: NSEMarketRegime = {
    nifty50Price: Math.round(nifty.price * 100) / 100, nifty50Change: Math.round(nifty.change * 100) / 100, nifty50Trend: nTrend,
    nifty50Ema20: Math.round(ema20), nifty50Ema50: Math.round(ema50), nifty50Ema200: Math.round(ema200),
    bankNiftyPrice: Math.round(bank.price * 100) / 100, bankNiftyChange: Math.round(bank.change * 100) / 100, bankNiftyTrend: bTrend,
    vix: Math.round(vix * 100) / 100, vixLevel, adRatio: vix < 15 ? 1.8 : vix < 20 ? 1.2 : 0.8,
    marketScore: mScore, marketOk: mScore >= 5 && vixLevel !== "high", timestamp: new Date().toISOString(),
  };
  marketCache = { data: regime, expiry: Date.now() + 10 * 60 * 1000 };
  return regime;
}

function computeSectorScores(priceMap: Record<string, { price: number; change: number }>, newsMap: Record<string, any[]>, catMap: Record<string, string[]>): NSESectorScore[] {
  const grp: Record<string, { stocks: string[]; changes: number[] }> = {};
  for (const s of _catalog) {
    const sym = s.symbol.replace(".NS", "");
    const pd = priceMap[sym] || priceMap[s.symbol];
    if (!pd?.price) continue;
    grp[s.sector] = grp[s.sector] || { stocks: [], changes: [] };
    grp[s.sector].stocks.push(sym);
    grp[s.sector].changes.push(pd.change || 0);
  }
  return Object.entries(grp).filter(([, d]) => d.stocks.length >= 2).map(([sector, { stocks, changes }]) => {
    const pos      = changes.filter(c => c > 0).length;
    const rsScore  = Math.round((pos / stocks.length) * 25);
    const avg      = changes.reduce((a, b) => a + b, 0) / changes.length;
    const momScore = Math.round(Math.min(25, Math.max(0, ((avg + 3) / 6) * 25)));
    const catCnt   = stocks.filter(s => (catMap[s] || []).length > 0).length;
    const volScore = Math.round(Math.min(20, (catCnt / stocks.length) * 20 + 10));
    const posNews  = stocks.filter(s => (newsMap[s] || []).some((n: any) => n.sentiment === "positive")).length;
    const instScore = Math.round(Math.min(20, (posNews / stocks.length) * 20 + 5));
    const newsCnt  = stocks.filter(s => (newsMap[s] || []).length > 0).length;
    const newsScore = Math.round(Math.min(10, (newsCnt / stocks.length) * 10 + 2));
    const score    = Math.min(100, rsScore + momScore + volScore + instScore + newsScore);
    return { sector, score, rsScore, momentumScore: momScore, volumeScore: volScore, institutionalScore: instScore, newsScore, stockCount: stocks.length, avgChange: Math.round(avg * 100) / 100, qualifies: score >= 80 };
  }).sort((a, b) => b.score - a.score);
}

// ─── LAYER 3: SCORING ENGINE ──────────────────────────────────────────────────

function detectBreakout(closes: number[], highs: number[], lows: number[], volumes: number[], yearHigh: number): { type: string; quality: number } {
  if (closes.length < 20) return { type: "none", quality: 0 };
  const len = closes.length;
  const latH = highs[len - 1], latV = volumes[len - 1] || 0;
  const avg20V = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const vr = avg20V > 0 ? latV / avg20V : 1;
  const res20 = Math.max(...highs.slice(-20, -1));
  const yr52 = yearHigh || Math.max(...highs);
  const l10 = Math.min(...lows.slice(-10)), h10 = Math.max(...highs.slice(-10));
  const range = l10 > 0 ? (h10 - l10) / l10 : 1;
  let type = "none", quality = 0;
  if (yr52 > 0 && latH >= yr52 * 0.99 && vr >= 1.5) { type = "52_WEEK_HIGH_BREAKOUT"; quality = 15; }
  else if (latH > res20 * 1.005 && vr >= 1.5) { type = "RESISTANCE_BREAKOUT"; quality = 12; }
  else if (range < 0.03 && latH > h10 * 1.005 && vr >= 1.3) { type = "TIGHT_BASE_BREAKOUT"; quality = 11; }
  else if (vr >= 2.5 && closes[len - 1] > closes[len - 2]) { type = "VOLUME_BREAKOUT"; quality = 8; }
  if (quality > 0 && vr < 1.5) quality = Math.round(quality * 0.6);
  return { type, quality: Math.min(15, quality) };
}

function detectSMC(closes: number[], highs: number[], lows: number[], volumes: number[]): { orderBlock: boolean; fvg: boolean; demandZone: boolean; smcScore: number } {
  if (closes.length < 10) return { orderBlock: false, fvg: false, demandZone: false, smcScore: 0 };
  const len = closes.length, lat = closes[len - 1];
  let ob = false, fvg = false;
  for (let i = Math.max(1, len - 10); i < len - 2; i++) {
    if (closes[i] < closes[i - 1] && closes[i + 1] > closes[i] && lat >= lows[i] * 0.99 && lat <= highs[i] * 1.01) { ob = true; break; }
  }
  for (let i = Math.max(1, len - 8); i < len - 1; i++) {
    const ni = Math.min(i + 1, len - 1);
    const gap = lows[i - 1] - highs[ni];
    if (gap > 0 && gap / closes[i] < 0.02 && lat >= highs[ni] && lat <= lows[i - 1]) { fvg = true; break; }
  }
  const dz = _calcOBV(closes, volumes) === "rising" && closes[len - 1] > closes[len - 2];
  const smcScore = Math.min(10, (ob ? 4 : 0) + (fvg ? 3 : 0) + (dz ? 3 : 0));
  return { orderBlock: ob, fvg, demandZone: dz, smcScore };
}

interface ScoreInput {
  symbol: string; name: string; sector: string; price: number; change: number;
  closes: number[]; highs: number[]; lows: number[]; volumes: number[];
  yearHigh: number; yearLow: number; deliveryPct: number;
  catalysts: string[];
  newsItems: { title: string; sentiment: string; source: string }[];
  fundamentals: { roe: number; debtToEquity: number; earningsGrowth: number; profitMargin: number; fundScore: number };
  institutional: { fiiQoQChange: number; diiQoQChange: number; instScore: number };
  marketRegime: NSEMarketRegime;
  sectorScore: number;
}

function scoreStock(inp: ScoreInput) {
  const { closes, highs, lows, volumes } = inp;
  const len = closes.length;
  const e20 = len >= 20  ? _calcEMA(closes, 20)  : inp.price;
  const e50 = len >= 50  ? _calcEMA(closes, 50)  : inp.price;
  const e200= len >= 200 ? _calcEMA(closes, 200) : inp.price;
  const rsi = len >= 15  ? _calcRSI(closes)      : 50;
  const adx = len >= 30  ? _calcADX(highs, lows, closes) : 15;
  const atr = len >= 15  ? _calcATR(highs, lows, closes) : inp.price * 0.02;
  const macd= _calcMACD(closes);
  const obv = _calcOBV(closes, volumes);
  const ms  = _detectMS(highs, lows, closes);
  const bo  = detectBreakout(closes, highs, lows, volumes, inp.yearHigh);
  const smc = detectSMC(closes, highs, lows, volumes);
  const lV  = volumes[len - 1] || 0;
  const avg20V = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const vr  = avg20V > 0 ? lV / avg20V : 1;
  const trend: "bullish" | "bearish" | "neutral" =
    inp.price > e20 && e20 > e50 && e50 > e200 ? "bullish" :
    inp.price < e20 && e20 < e50 ? "bearish" : "neutral";

  const mc = Math.min(10, inp.marketRegime.marketScore);
  const ss = Math.round(Math.min(15, (inp.sectorScore / 100) * 15));
  let ts = 0;
  if (trend === "bullish") ts += 10; else if (trend === "neutral") ts += 3;
  if (rsi >= 40 && rsi <= 70) ts += 4;
  if (adx > 25) ts += 3;
  if (macd.cross === "bullish_cross") ts += 3;
  if (ms === "BOS") ts += 2;
  if (obv === "rising") ts += 2;
  ts = Math.min(20, ts);
  const bq = bo.quality;
  const vc = vr >= 2 ? 10 : vr >= 1.5 ? 7 : vr >= 1.2 ? 4 : 1;
  const sc = smc.smcScore;
  const fi = Math.min(10, inp.institutional.instScore);
  const fu = Math.min(5, Math.round(inp.fundamentals.fundScore));
  const rrVal = atr > 0 ? (atr * 2.5) / (atr * 1.5) : 0;
  const rs = rrVal >= 3 ? 5 : rrVal >= 2 ? 4 : rrVal >= 1.5 ? 2 : 0;
  const total = Math.min(100, Math.round(mc + ss + ts + bq + vc + sc + fi + fu + rs));

  const why: NSESwingSignal["whySelected"] = {
    market:       `Nifty ${inp.marketRegime.nifty50Trend} · VIX ${inp.marketRegime.vix.toFixed(1)} (${inp.marketRegime.vixLevel}) · Market ${inp.marketRegime.marketScore}/10`,
    sector:       `${inp.sector} sector score ${inp.sectorScore}/100${inp.sectorScore >= 80 ? " ✅" : ""}`,
    technical:    `${trend === "bullish" ? "EMA20>EMA50>EMA200 bullish stack" : "Near EMA support"} · RSI ${rsi.toFixed(0)} · ADX ${adx.toFixed(0)}`,
    breakout:     bo.type !== "none" ? `${bo.type.replace(/_/g, " ")} · ${vr.toFixed(1)}x avg vol` : "No clear breakout",
    smc:          [smc.orderBlock && "Order Block", smc.fvg && "FVG filled", smc.demandZone && "Demand zone"].filter(Boolean).join(" · ") || "Standard support",
    volume:       `${vr.toFixed(1)}x 20-day avg${inp.deliveryPct > 0 ? " · Delivery " + inp.deliveryPct.toFixed(0) + "%" : ""} · OBV ${obv}`,
    fiidii:       inp.institutional.fiiQoQChange !== 0 ? `FII ${inp.institutional.fiiQoQChange > 0 ? "+" : ""}${inp.institutional.fiiQoQChange.toFixed(1)}% · DII ${inp.institutional.diiQoQChange > 0 ? "+" : ""}${inp.institutional.diiQoQChange.toFixed(1)}% QoQ` : "Shareholding data unavailable",
    fundamentals: inp.fundamentals.roe > 0 ? `ROE ${inp.fundamentals.roe.toFixed(1)}% · D/E ${inp.fundamentals.debtToEquity.toFixed(1)} · EPS growth ${inp.fundamentals.earningsGrowth.toFixed(0)}%` : "Fundamentals pending",
    catalyst:     inp.catalysts.length > 0 ? inp.catalysts.slice(0, 2).join(" · ") : (inp.newsItems.find(n => n.sentiment === "positive")?.title?.slice(0, 80) || "No recent catalyst"),
  };
  return { totalScore: total, scoreBreakdown: { marketCondition: mc, sectorStrength: ss, technicalStructure: ts, breakoutQuality: bq, volumeConfirmation: vc, smcConfirmation: sc, fiidiiActivity: fi, fundamentals: fu, riskReward: rs }, atr, rrVal, whySelected: why };
}

async function generateAINarratives(candidates: { symbol: string; name: string; score: number; sector: string; why: string }[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!candidates.length) return out;
  try {
    const db = await _readDb();
    const key = process.env.GEMINI_API_KEY || db.config?.geminiApiKey || "";
    if (!key) return out;
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: key });
    const prompt = `You are an NSE institutional swing trading analyst. Write a precise 2-sentence research narrative for each stock. Be specific about: smart money interest, technical setup, risk/opportunity.

${candidates.map(c => `${c.name} (${c.symbol.replace(".NS","")}) | ${c.sector} | Score: ${c.score}/100\nContext: ${c.why}`).join("\n---\n")}

Respond ONLY as JSON: { "SYMBOL": "narrative..." }`;
    const resp = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: [{ role: "user", parts: [{ text: prompt }] }], config: { temperature: 0.3 } });
    const text = resp.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      for (const [k, v] of Object.entries(parsed)) out[k] = (v as string).slice(0, 220);
    }
  } catch {}
  return out;
}

// ─── LAYER 4: TELEGRAM ────────────────────────────────────────────────────────

function fmtAlert(sig: NSESwingSignal): string {
  const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (f: number, t: number) => ((t - f) / f * 100).toFixed(1);
  return `🔥 <b>NSE INSTITUTIONAL SWING ALERT</b> 🔥

📊 <b>Stock:</b> ${sig.name}
🔷 <b>Symbol:</b> <code>${sig.symbol.replace(".NS", "")}</code>
🏭 <b>Sector:</b> ${sig.sector}

🎯 <b>Confidence: ${sig.confidence}/100</b>

💰 <b>Price:</b> <code>${fmt(sig.currentPrice)}</code>
📍 <b>Entry:</b> <code>${fmt(sig.entryZoneLow)} – ${fmt(sig.entryZoneHigh)}</code>
🛑 <b>Stop Loss:</b> <code>${fmt(sig.stopLoss)}</code> (-${pct(sig.currentPrice, sig.stopLoss)}%)
🎯 <b>Target 1:</b> <code>${fmt(sig.target1)}</code> (+${pct(sig.currentPrice, sig.target1)}%)
🎯 <b>Target 2:</b> <code>${fmt(sig.target2)}</code> (+${pct(sig.currentPrice, sig.target2)}%)
⏱ <b>Holding:</b> ${sig.holdingPeriod}

<b>━━ WHY SELECTED ━━</b>
✅ <b>Market:</b> ${sig.whySelected.market}
✅ <b>Sector:</b> ${sig.whySelected.sector}
✅ <b>Technical:</b> ${sig.whySelected.technical}
✅ <b>Breakout:</b> ${sig.whySelected.breakout}
✅ <b>SMC:</b> ${sig.whySelected.smc}
✅ <b>Volume:</b> ${sig.whySelected.volume}
✅ <b>FII/DII:</b> ${sig.whySelected.fiidii}
✅ <b>Fundamentals:</b> ${sig.whySelected.fundamentals}
✅ <b>Catalyst:</b> ${sig.whySelected.catalyst}

📐 <b>Risk:Reward:</b> 1:${sig.riskReward.toFixed(1)}
❌ <b>Invalidation:</b> ${sig.invalidation}${sig.aiNarrative ? `\n\n🤖 <i>${sig.aiNarrative}</i>` : ""}

━━━━━━━━━━━━━━━━━━━━━
🤖 <i>NSE Institutional Swing Research Engine</i>`.trim();
}

function fmtNoSignal(reason: string): string {
  const dt = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
  return `🛡️ <b>NSE SWING SCAN — ${dt}</b>\n\n📊 <b>No A-Grade Setup Today</b>\n\n${reason}\n\n💡 <i>Only ≥90/100 signals dispatched. No signal is better than a bad signal.</i>\n\n━━━━━━━━━━━━━━━━━━━━━\n🤖 <i>NSE Institutional Swing Research Engine</i>`.trim();
}

// ─── MAIN ORCHESTRATOR ────────────────────────────────────────────────────────

export async function runNightlyNSEScan(): Promise<NSEScanResult> {
  if (scanRunning) throw new Error("Scan already in progress");
  scanRunning = true;
  const t0 = Date.now();
  console.log("[NSE-SWING] 🚀 Scan started:", new Date().toISOString());
  try {
    // 1. Market regime
    const regime = await analyzeNSEMarketRegime();
    console.log(`[NSE-SWING] Nifty ${regime.nifty50Price} | ${regime.nifty50Trend} | VIX ${regime.vix} | Score ${regime.marketScore}/10`);

    if (regime.marketScore <= 3 && regime.vixLevel === "high") {
      const reason = `Market deeply unfavorable: Nifty ${regime.nifty50Trend}, VIX ${regime.vix.toFixed(1)} (high). Not entering new swing positions.`;
      const result: NSEScanResult = { runAt: new Date().toISOString(), duration: Date.now() - t0, totalScanned: 0, sectorScores: [], marketRegime: regime, topCandidates: [], signals: [], noSignalReason: reason };
      lastResult = result;
      scanHistory.unshift({ runAt: result.runAt, signals: 0, scanned: 0 });
      if (scanHistory.length > 30) scanHistory.pop();
      const db = await _readDb();
      if (db.config?.telegramToken && db.config?.telegramChatId && db.config?.telegramEnabled)
        await _sendTg(db.config.telegramToken, db.config.telegramChatId, fmtNoSignal(reason));
      return result;
    }

    // 2. Data collection
    console.log("[NSE-SWING] Fetching bhavcopy, corporate actions, news...");
    const [bhavcopy, catMap, newsMap] = await Promise.all([
      fetchNSEBhavcopy(), fetchNSECorporateActions(),
      fetchNewsRSS(_catalog.map(s => s.symbol)),
    ]);

    const priceMap: Record<string, { price: number; change: number }> = {};
    for (const s of _catalog) {
      const sym = s.symbol.replace(".NS", "");
      const bh  = bhavcopy[sym];
      if (bh?.close > 0) priceMap[sym] = { price: bh.close, change: bh.open > 0 ? ((bh.close - bh.open) / bh.open) * 100 : 0 };
    }
    console.log(`[NSE-SWING] Bhavcopy: ${Object.keys(bhavcopy).length} | Catalysts: ${Object.keys(catMap).length} | News: ${Object.keys(newsMap).length}`);

    // 3. Sector scoring
    const sectorScores = computeSectorScores(priceMap, newsMap, catMap);
    const activeSectors = new Set(sectorScores.filter(s => s.qualifies).map(s => s.sector));
    console.log(`[NSE-SWING] Sectors: ${sectorScores.length} ranked, ${activeSectors.size} qualify`);

    // 4. Pre-filter + proxy sort
    const top60 = _catalog.filter(s => {
      if (!activeSectors.has(s.sector)) return false;
      const sym = s.symbol.replace(".NS", "");
      const pd = priceMap[sym];
      if (!pd || pd.price < 30) return false;
      const bh = bhavcopy[sym];
      if (bh && bh.volume < 50_000) return false;
      return true;
    }).map(s => {
      const sym = s.symbol.replace(".NS", "");
      const pd  = priceMap[sym] || { price: 0, change: 0 };
      return { s, proxy: pd.change + (catMap[sym]?.length || 0) * 3 + ((newsMap[sym] || []).filter((n: any) => n.sentiment === "positive").length) * 2 };
    }).sort((a, b) => b.proxy - a.proxy).slice(0, 60).map(x => x.s);

    console.log(`[NSE-SWING] Deep-analyzing ${top60.length} candidates...`);

    // 5. Technical scoring
    const scored: { s: typeof _catalog[0]; res: ReturnType<typeof scoreStock>; price: number }[] = [];
    for (let i = 0; i < top60.length; i++) {
      const s = top60[i], symNS = s.symbol, sym = symNS.replace(".NS", "");
      try {
        const candles = await fetchYahooDailyCandles(symNS, 250);
        if (candles.closes.length < 30) continue;
        const pd   = priceMap[sym] || { price: candles.closes[candles.closes.length - 1] || 0, change: 0 };
        if (!pd.price) continue;
        const bh   = bhavcopy[sym] || {};
        const sc   = sectorScores.find(x => x.sector === s.sector)?.score || 50;
        const inst = await fetchNSEShareholding(symNS);
        const funds = i < 30 ? await fetchYahooFundamentals(symNS) : { roe: 0, roce: 0, debtToEquity: 0, profitMargin: 0, earningsGrowth: 0, fundScore: 2 };
        const res  = scoreStock({ symbol: symNS, name: s.name, sector: s.sector, price: pd.price, change: pd.change, closes: candles.closes, highs: candles.highs, lows: candles.lows, volumes: candles.volumes, yearHigh: bh.yearHigh || 0, yearLow: bh.yearLow || 0, deliveryPct: bh.deliveryPct || 0, catalysts: catMap[sym] || [], newsItems: newsMap[sym] || [], fundamentals: funds as any, institutional: inst, marketRegime: regime, sectorScore: sc });
        scored.push({ s, res, price: pd.price });
        if (i % 10 === 9) await new Promise(r => setTimeout(r, 400));
      } catch {}
    }
    scored.sort((a, b) => b.res.totalScore - a.res.totalScore);
    console.log(`[NSE-SWING] Scored ${scored.length} | Top: ${scored[0]?.res.totalScore || 0}`);

    // 6. AI narratives
    const aiNar = await generateAINarratives(scored.slice(0, 5).map(c => ({
      symbol: c.s.symbol, name: c.s.name, sector: c.s.sector, score: c.res.totalScore,
      why: Object.values(c.res.whySelected).join(" | ").slice(0, 300),
    })));

    // 7. Build signals
    const signals: NSESwingSignal[] = [];
    for (const cand of scored) {
      if (cand.res.totalScore < 90) break;
      const sym = cand.s.symbol.replace(".NS", "");
      if ((newsMap[sym] || []).filter((n: any) => n.sentiment === "negative").length >= 2) continue;
      const p = cand.price, atr = cand.res.atr, rrVal = cand.res.rrVal;
      if (rrVal < 1.5) continue;
      const sl  = Math.round((p - atr * 1.5) * 100) / 100;
      const tp1 = Math.round((p + atr * 2.5) * 100) / 100;
      const tp2 = Math.round((p + atr * 4.5) * 100) / 100;
      const rr  = sl < p ? Math.round(((tp1 - p) / (p - sl)) * 10) / 10 : 0;
      signals.push({
        symbol: cand.s.symbol, name: cand.s.name, sector: cand.s.sector, currentPrice: p,
        entryZoneLow: Math.round((p - atr * 0.3) * 100) / 100, entryZoneHigh: Math.round((p + atr * 0.2) * 100) / 100,
        stopLoss: sl, target1: tp1, target2: tp2, holdingPeriod: "3–12 trading days",
        confidence: cand.res.totalScore, totalScore: cand.res.totalScore,
        scoreBreakdown: cand.res.scoreBreakdown, whySelected: cand.res.whySelected,
        riskReward: rr, invalidation: `Daily close below ₹${sl.toLocaleString("en-IN")} invalidates setup`,
        aiNarrative: aiNar[sym] || "", timestamp: new Date().toISOString(),
      });
      if (signals.length >= 3) break;
    }

    const noSignalReason = signals.length === 0
      ? `Analyzed ${scored.length} stocks across ${activeSectors.size} sectors. Top score was ${scored[0]?.res.totalScore || 0}/100. Threshold is 90. Check tomorrow.`
      : undefined;

    const result: NSEScanResult = {
      runAt: new Date().toISOString(), duration: Date.now() - t0,
      totalScanned: top60.length, sectorScores, marketRegime: regime,
      topCandidates: scored.slice(0, 15).map(c => ({ symbol: c.s.symbol, name: c.s.name, sector: c.s.sector, score: c.res.totalScore, price: c.price })),
      signals, noSignalReason,
    };
    lastResult = result;
    scanHistory.unshift({ runAt: result.runAt, signals: signals.length, scanned: result.totalScanned });
    if (scanHistory.length > 30) scanHistory.pop();

    // 8. Telegram
    try {
      const db = await _readDb();
      const tok = db.config?.telegramToken || process.env.TELEGRAM_TOKEN || "8253888894:AAFO9W1wtknSYMBBA0RIr0zXcewNBg_msDk";
      const cid = db.config?.telegramChatId || process.env.TELEGRAM_CHAT_ID || "2047918333";
      if (tok && cid) {
        if (signals.length === 0) {
          await _sendTg(tok, cid, fmtNoSignal(noSignalReason!));
          console.log("[NSE-SWING] 📱 Sent 'No Signal Today' Telegram report");
        } else {
          for (const sig of signals) {
            await _sendTg(tok, cid, fmtAlert(sig), undefined, { symbol: sig.symbol, side: "LONG" as const, market: "INDIAN_EQUITY", entryPrice: sig.currentPrice, sl: sig.stopLoss, tp1: sig.target1, tp2: sig.target2, notes: `NSE Swing · Score ${sig.totalScore}/100` });
            await new Promise(r => setTimeout(r, 1000));
          }
          console.log(`[NSE-SWING] 📱 Sent ${signals.length} A-Grade Telegram Alert(s)`);
        }
      } else {
        console.log("[NSE-SWING] ⚠️ Telegram skipped: token or chatId missing");
      }
    } catch (e) { console.error("[NSE-SWING] Telegram error:", e); }

    console.log(`[NSE-SWING] ✅ Done in ${((Date.now() - t0) / 1000).toFixed(1)}s · ${signals.length} signal(s)`);
    return result;
  } finally {
    scanRunning = false;
  }
}

// ─── 9:45 AM MORNING LIVE SCAN & STRATEGY UPDATE ──────────────────────────────

function fmtMorningReport(res: NSEMorningScanResult): string {
  const dt = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
  const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let text = `🌅 <b>NSE MORNING STRATEGY & CHANGE OF PLAN REPORT</b>\n`;
  text += `📅 <b>Date: ${dt} | Time: 9:45 AM IST</b>\n\n`;
  text += `📊 <b>Nifty 50:</b> ${res.marketRegime945.nifty50Price} (${res.marketRegime945.nifty50Change >= 0 ? "+" : ""}${res.marketRegime945.nifty50Change}%) · VIX: ${res.marketRegime945.vix.toFixed(1)}\n`;

  if (res.changeOfPlan) {
    text += `\n🚨 <b>CHANGE OF PLAN NOTICE:</b>\n<b>${res.changeOfPlanReason}</b>\n\n`;
  }

  if (!res.signalStatuses.length) {
    text += `\nℹ️ <i>No pending swing trades were active from midnight scan.</i>\n`;
  } else {
    text += `\n<b>━━━━ 9:45 AM TRADE RE-EVALUATION (TOP 3) ━━━━</b>\n\n`;
    for (const s of res.signalStatuses) {
      const sig = s.nightlySignal;
      const statusEmoji =
        s.status === "CONFIRMED_IN_ZONE" ? "🟢 <b>CONFIRMED IN ENTRY ZONE</b>" :
        s.status === "GAP_UP_WAIT" ? "⚠️ <b>GAP UP — DO NOT CHASE</b>" :
        s.status === "INVALIDATED_BELOW_SL" ? "🛑 <b>TRADE CANCELLED</b>" :
        s.status === "T1_REACHED_SKIP" ? "🚀 <b>TARGET 1 REACHED</b>" :
        "🔵 <b>HOLD / WATCHING</b>";

      text += `🔷 <b>${sig.name}</b> (<code>${sig.symbol.replace(".NS", "")}</code>)\n`;
      text += `• Status: ${statusEmoji}\n`;
      text += `• Live 9:45 AM Price: <code>${fmt(s.livePrice945)}</code> (Gap: ${s.gapPct >= 0 ? "+" : ""}${s.gapPct.toFixed(2)}%)\n`;
      text += `• Entry Zone: <code>${fmt(sig.entryZoneLow)} – ${fmt(sig.entryZoneHigh)}</code>\n`;
      text += `• Action: <i>${s.actionText}</i>\n\n`;
    }
  }

  text += `━━━━━━━━━━━━━━━━━━━━━\n🤖 <i>NSE Institutional Swing Research Engine · 9:45 AM Live Scan</i>`;
  return text.trim();
}

export async function runMorningNSEScan(): Promise<NSEMorningScanResult> {
  const t0 = Date.now();
  console.log("[NSE-SWING] 🌅 Starting 9:45 AM Morning Scan...");

  const regime945 = await analyzeNSEMarketRegime();

  if (!lastResult || !lastResult.signals) {
    try { await runNightlyNSEScan(); } catch {}
  }

  const signals = lastResult?.signals || [];
  const statuses: NSEMorningSignalStatus[] = [];
  let changeOfPlan = false;
  let changeOfPlanReason = "";

  if (!regime945.marketOk || regime945.vixLevel === "high") {
    changeOfPlan = true;
    changeOfPlanReason = `Morning market volatility spike (VIX: ${regime945.vix.toFixed(1)}). Exercise high caution before executing new buys today.`;
  }

  if (signals.length > 0) {
    const syms = signals.map(s => s.symbol);
    const livePrices = await _getLivePrices(syms);

    for (const sig of signals) {
      const symKey = sig.symbol;
      const pd = livePrices[symKey] || { price: sig.currentPrice, change: 0 };
      const liveP = pd.price > 0 ? pd.price : sig.currentPrice;
      const gapPct = sig.currentPrice > 0 ? ((liveP - sig.currentPrice) / sig.currentPrice) * 100 : 0;

      let status: NSEMorningSignalStatus["status"] = "CONFIRMED_IN_ZONE";
      let actionText = "";

      if (liveP < sig.stopLoss) {
        status = "INVALIDATED_BELOW_SL";
        actionText = "Price dropped below Stop Loss at open. Trade is CANCELLED. Do not enter.";
        changeOfPlan = true;
        changeOfPlanReason = `Stock ${sig.symbol.replace(".NS", "")} broke Stop Loss at market open. Trade invalidated.`;
      } else if (liveP >= sig.target1) {
        status = "T1_REACHED_SKIP";
        actionText = "Target 1 hit at open gap-up. Risk/Reward no longer favorable. Skip entry.";
        changeOfPlan = true;
        changeOfPlanReason = `Stock ${sig.symbol.replace(".NS", "")} hit Target 1 directly at open.`;
      } else if (liveP > sig.entryZoneHigh * 1.01) {
        status = "GAP_UP_WAIT";
        actionText = `Opened +${gapPct.toFixed(1)}% above entry zone. DO NOT CHASE. Set limit order at ₹${sig.entryZoneHigh}.`;
      } else if (liveP >= sig.entryZoneLow && liveP <= sig.entryZoneHigh * 1.01) {
        status = "CONFIRMED_IN_ZONE";
        actionText = `Price is inside ideal entry zone (₹${sig.entryZoneLow}–₹${sig.entryZoneHigh}). Execute entry now.`;
      } else {
        status = "GAP_DOWN_HOLD";
        actionText = `Slight dip below entry zone but above SL (₹${sig.stopLoss}). Hold limit order at ₹${sig.entryZoneLow}.`;
      }

      statuses.push({
        symbol: sig.symbol,
        name: sig.name,
        nightlySignal: sig,
        livePrice945: liveP,
        gapPct,
        status,
        actionText,
      });
    }
  }

  const result: NSEMorningScanResult = {
    runAt: new Date().toISOString(),
    marketRegime945: regime945,
    signalStatuses: statuses,
    changeOfPlan,
    changeOfPlanReason,
  };

  lastMorningResult = result;

  try {
    const db = await _readDb();
    const tok = db.config?.telegramToken || process.env.TELEGRAM_TOKEN || "8253888894:AAFO9W1wtknSYMBBA0RIr0zXcewNBg_msDk";
    const cid = db.config?.telegramChatId || process.env.TELEGRAM_CHAT_ID || "2047918333";
    if (tok && cid) {
      await _sendTg(tok, cid, fmtMorningReport(result));
      console.log("[NSE-SWING] 📱 Sent 9:45 AM Telegram Strategy Update Report");
    } else {
      console.log("[NSE-SWING] ⚠️ 9:45 AM Telegram report skipped: token/chatId missing");
    }
  } catch (e) { console.error("[NSE-SWING] 9:45 AM Telegram report failed:", e); }

  console.log(`[NSE-SWING] ✅ Morning scan complete in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return result;
}

// ─── DUAL SCHEDULER (12:00 AM IST & 9:45 AM IST) ──────────────────────────────

export function startNSESwingScheduler() {
  console.log("[NSE-SWING] Scheduler active — Nightly 12:00 AM IST & Morning 9:45 AM IST");
  setInterval(async () => {
    try {
      const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const h = ist.getHours();
      const m = ist.getMinutes();
      const today = ist.toDateString();

      // Check #1: Nightly Scan at 12:00 AM IST (00:00–00:04)
      if (h === 0 && m < 5 && !scanRunning) {
        const lastNightlyDate = lastResult?.runAt
          ? new Date(new Date(lastResult.runAt).toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).toDateString()
          : "";
        if (lastNightlyDate !== today) {
          console.log("[NSE-SWING] 🕛 12:00 AM IST — starting nightly scan...");
          runNightlyNSEScan().catch(e => console.error("[NSE-SWING] Nightly scan error:", e));
        }
      }

      // Check #2: Morning Live Strategy Update at 9:45 AM IST (09:45–09:49)
      if (h === 9 && m >= 45 && m < 50 && !scanRunning) {
        const lastMorningDate = lastMorningResult?.runAt
          ? new Date(new Date(lastMorningResult.runAt).toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).toDateString()
          : "";
        if (lastMorningDate !== today) {
          console.log("[NSE-SWING] 🌅 9:45 AM IST — starting morning live market strategy update scan...");
          runMorningNSEScan().catch(e => console.error("[NSE-SWING] Morning scan error:", e));
        }
      }
    } catch {}
  }, 60_000);
}

// ─── REGISTER API ROUTES ──────────────────────────────────────────────────────

export function registerNSESwingRoutes(app: import("express").Express) {
  app.post("/api/nse-swing/run-scan", async (req: any, res: any) => {
    if (scanRunning) return res.json({ running: true, message: "Scan in progress — please wait" });
    try {
      const result = await runNightlyNSEScan();
      res.json({ result, history: scanHistory });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Scan failed" });
    }
  });

  app.post("/api/nse-swing/run-morning-scan", async (req: any, res: any) => {
    try {
      const result = await runMorningNSEScan();
      res.json({ result });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Morning scan failed" });
    }
  });

  app.post("/api/nse-swing/test-telegram", async (req: any, res: any) => {
    try {
      const db = await _readDb();
      const tok = db.config?.telegramToken || process.env.TELEGRAM_TOKEN || "8253888894:AAFO9W1wtknSYMBBA0RIr0zXcewNBg_msDk";
      const cid = db.config?.telegramChatId || process.env.TELEGRAM_CHAT_ID || "2047918333";
      const testMsg = `📱 <b>NSE SWING ENGINE TELEGRAM TEST</b>\n\n✅ Connection active!\n🇮🇳 Your NSE Institutional Research Engine is connected to Telegram.\n\n📅 <i>${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</i>`;
      const result = await _sendTg(tok, cid, testMsg);
      res.json({ success: true, result });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message || "Failed to send test Telegram alert" });
    }
  });

  app.get("/api/nse-swing/last-result", (_req: any, res: any) => {
    res.json({ result: lastResult, morningResult: lastMorningResult, history: scanHistory, running: scanRunning });
  });

  app.get("/api/nse-swing/morning-result", (_req: any, res: any) => {
    res.json({ result: lastMorningResult });
  });

  app.get("/api/nse-swing/market-regime", async (_req: any, res: any) => {
    try {
      const regime = await analyzeNSEMarketRegime();
      res.json({ regime });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed", regime: null });
    }
  });

  app.get("/api/nse-swing/sector-scores", async (_req: any, res: any) => {
    try {
      if (sectorCache && Date.now() < sectorCache.expiry) return res.json({ sectors: sectorCache.data });
      if (lastResult?.sectorScores?.length) return res.json({ sectors: lastResult.sectorScores });
      const prices = await _getLivePrices(_catalog.slice(0, 80).map(s => s.symbol));
      const pm: Record<string, { price: number; change: number }> = {};
      for (const [sym, pd] of Object.entries(prices)) pm[sym.replace(".NS", "")] = pd;
      const sectors = computeSectorScores(pm, {}, {});
      sectorCache = { data: sectors, expiry: Date.now() + 15 * 60 * 1000 };
      res.json({ sectors });
    } catch (e: any) { res.status(500).json({ error: e.message || "Failed", sectors: [] }); }
  });

  app.get("/api/nse-swing/stock-score/:symbol", async (req: any, res: any) => {
    try {
      const sym   = (req.params.symbol || "").toUpperCase().replace(".NS", "");
      const symNS = sym + ".NS";
      const info  = _catalog.find(s => s.symbol.replace(".NS", "") === sym) || { symbol: symNS, name: sym, sector: "Unknown" };
      const [candles, inst, funds, regime] = await Promise.all([
        fetchYahooDailyCandles(symNS, 250), fetchNSEShareholding(symNS), fetchYahooFundamentals(symNS), analyzeNSEMarketRegime(),
      ]);
      const prices = await _getLivePrices([symNS]);
      const pd = prices[symNS] || { price: candles.closes[candles.closes.length - 1] || 0, change: 0 };
      const result = scoreStock({ symbol: symNS, name: info.name, sector: info.sector, price: pd.price, change: pd.change, closes: candles.closes, highs: candles.highs, lows: candles.lows, volumes: candles.volumes, yearHigh: 0, yearLow: 0, deliveryPct: 0, catalysts: [], newsItems: [], fundamentals: funds, institutional: inst, marketRegime: regime, sectorScore: 70 });
      res.json({ symbol: symNS, name: info.name, price: pd.price, ...result, marketRegime: regime });
    } catch (e: any) { res.status(500).json({ error: e.message || "Failed" }); }
  });

  app.get("/api/nse-swing/history", (_req: any, res: any) => {
    res.json({ history: scanHistory });
  });
}
