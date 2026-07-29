import React, { useState, useRef } from "react";
import { BotConfig } from "../types";
import { ArrowUpRight, ArrowDownRight, Upload, Play, CheckCircle, Percent, AlertCircle, Sparkles, Download, HelpCircle, RefreshCw } from "lucide-react";

interface BacktestEngineProps {
  config: BotConfig;
}

interface BacktestResult {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  netProfitPct: number;
  profitFactor: number;
  maxDrawdownPct: number;
  initialBalance: number;
  finalBalance: number;
  equityCurve: number[];
  trades: SimulatedTrade[];
}

interface SimulatedTrade {
  id: number;
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  entryTime: string;
  exitPrice: number;
  exitTime: string;
  score: number;
  status: "WIN" | "LOSS" | "OPEN";
  pnlPercentage: number;
  stopLoss: number;
  takeProfit: number;
}

// Generate high quality BTCUSDT 4H swing historical candles trigger arrays
const PRELOADED_BTC_DATA = `timestamp,price,utbot,ema_crossover,rsi,macd,market_structure,volume
2026-06-01 00:00,98500,hold,bearish,neutral,neutral,None,Normal
2026-06-01 04:00,98200,hold,bearish,neutral,neutral,None,Normal
2026-06-01 08:00,97600,hold,bearish,neutral,neutral,None,Normal
2026-06-01 12:00,96800,hold,bearish,oversold,neutral,None,High
2026-06-01 16:00,96500,buy,bearish,oversold,bullish_cross,None,High
2026-06-02 00:00,97400,hold,bearish,neutral,neutral,None,Normal
2026-06-02 04:00,97900,hold,bearish,neutral,neutral,None,Normal
2026-06-02 08:00,98800,hold,bullish,neutral,neutral,BOS,High
2026-06-02 12:00,99600,hold,bullish,neutral,neutral,None,Normal
2026-06-02 16:00,100500,hold,bullish,neutral,neutral,None,Normal
2026-06-03 00:00,101200,hold,bullish,neutral,neutral,None,Normal
2026-06-03 04:00,100800,hold,bullish,neutral,neutral,None,Normal
2026-06-03 08:00,100200,hold,bullish,neutral,neutral,None,Normal
2026-06-03 12:00,100900,hold,bullish,neutral,neutral,None,Normal
2026-06-03 16:00,101850,hold,bullish,neutral,neutral,BOS,High
2026-06-04 00:00,102500,hold,bullish,neutral,neutral,None,Normal
2026-06-04 04:00,103100,hold,bullish,neutral,neutral,None,Normal
2026-06-04 08:00,102800,hold,bullish,neutral,neutral,None,Normal
2026-06-04 12:00,102100,hold,bullish,neutral,neutral,None,Normal
2026-06-04 16:00,101400,hold,bullish,neutral,bearish_cross,None,Normal
2026-06-05 00:00,100500,hold,bullish,neutral,neutral,None,Normal
2026-06-05 04:00,99800,hold,bearish,neutral,neutral,CHOCH,High
2026-06-05 08:00,99200,sell,bearish,neutral,neutral,None,Normal
2026-06-05 12:00,98400,hold,bearish,neutral,neutral,None,Normal
2026-06-05 16:00,97600,hold,bearish,neutral,neutral,None,Normal
2026-06-06 00:00,98100,hold,bearish,neutral,neutral,None,Normal
2026-06-06 04:00,98900,hold,bearish,neutral,neutral,None,Normal
2026-06-06 08:00,99600,hold,bearish,neutral,neutral,None,Normal
2026-06-06 12:00,100300,hold,bearish,neutral,neutral,None,Normal
2026-06-06 16:00,101100,hold,bearish,neutral,neutral,None,Normal
`;

export default function BacktestEngine({ config }: BacktestEngineProps) {
  const [csvContent, setCsvContent] = useState<string>(PRELOADED_BTC_DATA);
  const [pastedCsv, setPastedCsv] = useState<string>("");
  const [fileName, setFileName] = useState<string>("BTC_4H_Swing_Preset");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BacktestResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCsvContent(text);
      };
      reader.readAsText(file);
    }
  };

  const handlePastChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPastedCsv(text);
    if (text.trim() !== "") {
      setCsvContent(text);
      setFileName("pasted_custom_data.csv");
    }
  };

  const parseAndRunBacktest = () => {
    setLoading(true);
    setResults(null);

    setTimeout(() => {
      try {
        const rows = csvContent.split("\n").map(r => r.trim()).filter(r => r.length > 0);
        if (rows.length < 2) {
          alert("Insufficient rows to execute backtest simulation.");
          setLoading(false);
          return;
        }

        const headers = rows[0].split(",");
        const dataRows = rows.slice(1);

        const historicalData = dataRows.map((row, i) => {
          const cells = row.split(",");
          const record: Record<string, string> = {};
          headers.forEach((header, index) => {
            record[header.trim().toLowerCase()] = cells[index]?.trim() || "";
          });
          return record;
        });

        const initialBalance = 10000;
        let balance = initialBalance;
        const simulatedTrades: SimulatedTrade[] = [];
        const equityCurve: number[] = [initialBalance];
        let activeTrade: any = null;
        let tradeIdCounter = 1;

        const evaluateSignal = (item: Record<string, string>) => {
          const utbot = item.utbot?.toLowerCase() || "hold";
          const ema_crossover = item.ema_crossover?.toLowerCase() || "";
          const rsi = item.rsi?.toLowerCase() || "";
          const macd = item.macd?.toLowerCase() || "";
          const ms = item.market_structure?.toUpperCase() || "";
          const volume = item.volume?.toLowerCase() || "normal";

          const isBuy = utbot === "buy" || rsi === "oversold";
          const isSell = utbot === "sell" || rsi === "overbought";
          if (!isBuy && !isSell) return null;

          const side = isBuy ? "LONG" : "SHORT";
          const weights = config.confluenceWeights;
          let calculatedScore = 0;

          // Compute weights
          if (utbot === (isBuy ? "buy" : "sell")) calculatedScore += weights.utbot;
          
          const emaAligned = isBuy ? (ema_crossover === "bullish") : (ema_crossover === "bearish");
          if (emaAligned) calculatedScore += weights.ema_crossover;

          const rsiAligned = isBuy ? (rsi === "oversold") : (rsi === "overbought");
          if (rsiAligned) calculatedScore += weights.rsi;

          const macdAligned = isBuy ? (macd === "bullish_cross") : (macd === "bearish_cross");
          if (macdAligned) calculatedScore += weights.macd;

          const hasMs = ms === "BOS" || ms === "CHOCH";
          if (hasMs) calculatedScore += weights.market_structure;

          if (volume === "high") calculatedScore += weights.volume;

          // Apply filters
          const filters = config.filters;
          let blocked = false;

          if (filters.rejectLowVolume && volume === "low") blocked = true;
          if (filters.rejectAgainstEmaTrend && !emaAligned) blocked = true;
          if (filters.rejectRsiOverbought && (isBuy ? rsi === "overbought" : rsi === "oversold")) blocked = true;
          if (filters.requireStructureConfirmation && !hasMs) blocked = true;

          if (calculatedScore < config.confidenceThreshold) blocked = true;

          return {
            side,
            score: calculatedScore,
            blocked
          };
        };

        historicalData.forEach((row, idx) => {
          const price = parseFloat(row.price) || 0;
          const timestamp = row.timestamp || `Bar ${idx + 1}`;

          // Check exits
          if (activeTrade) {
            let exited = false;
            let exitPrice = price;
            let pnl = 0;

            // Swing trades stops are wider: default 4% Stop Loss and 10% Target
            const slDistance = activeTrade.entryPrice * 0.04;
            const tpDistance = slDistance * 2.5;

            if (activeTrade.side === "LONG") {
              if (price <= activeTrade.entryPrice - slDistance) {
                exited = true;
                exitPrice = activeTrade.entryPrice - slDistance;
                pnl = -4.0;
              } else if (price >= activeTrade.entryPrice + tpDistance) {
                exited = true;
                exitPrice = activeTrade.entryPrice + tpDistance;
                pnl = 10.0;
              }
            } else {
              if (price >= activeTrade.entryPrice + slDistance) {
                exited = true;
                exitPrice = activeTrade.entryPrice + slDistance;
                pnl = -4.0;
              } else if (price <= activeTrade.entryPrice - tpDistance) {
                exited = true;
                exitPrice = activeTrade.entryPrice - tpDistance;
                pnl = 10.0;
              }
            }

            if (exited) {
              const tradeResult = activeTrade;
              tradeResult.exitPrice = Number(exitPrice.toFixed(2));
              tradeResult.exitTime = timestamp;
              tradeResult.status = pnl > 0 ? "WIN" : "LOSS";
              tradeResult.pnlPercentage = pnl;

              balance = balance * (1 + pnl / 100);
              simulatedTrades.push(tradeResult);
              activeTrade = null;
            }
          }

          // Scan setup entries
          if (!activeTrade) {
            const evaluation = evaluateSignal(row);
            if (evaluation && !evaluation.blocked) {
              const slDistance = price * 0.04;
              const sl = evaluation.side === "LONG" ? price - slDistance : price + slDistance;
              const tp = evaluation.side === "LONG" ? price + slDistance * 2.5 : price - slDistance * 2.5;

              activeTrade = {
                id: tradeIdCounter++,
                symbol: row.symbol?.toUpperCase() || "BTCUSDT",
                side: evaluation.side as "LONG" | "SHORT",
                entryPrice: price,
                entryTime: timestamp,
                exitPrice: 0,
                exitTime: "",
                score: evaluation.score,
                status: "OPEN",
                pnlPercentage: 0,
                stopLoss: Number(sl.toFixed(2)),
                takeProfit: Number(tp.toFixed(2))
              };
            }
          }

          equityCurve.push(Number(balance.toFixed(2)));
        });

        if (activeTrade) {
          activeTrade.status = "LOSS";
          activeTrade.exitPrice = activeTrade.stopLoss;
          activeTrade.exitTime = "End of Backtest";
          activeTrade.pnlPercentage = -4.0;
          balance = balance * 0.96;
          simulatedTrades.push(activeTrade);
          equityCurve.push(Number(balance.toFixed(2)));
        }

        const wins = simulatedTrades.filter(t => t.status === "WIN").length;
        const losses = simulatedTrades.filter(t => t.status === "LOSS").length;
        const totalTrades = simulatedTrades.length;
        const winRate = totalTrades > 0 ? Number(((wins / totalTrades) * 100).toFixed(1)) : 0;
        const netProfitPct = Number((((balance - initialBalance) / initialBalance) * 100).toFixed(2));

        const grossProfit = simulatedTrades.filter(t => t.pnlPercentage > 0).reduce((sum, t) => sum + t.pnlPercentage, 0);
        const grossLoss = Math.abs(simulatedTrades.filter(t => t.pnlPercentage < 0).reduce((sum, t) => sum + t.pnlPercentage, 0));
        const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 5.0 : 0.0;

        let maxBalance = initialBalance;
        let maxDrawdown = 0;
        equityCurve.forEach(val => {
          if (val > maxBalance) maxBalance = val;
          const dd = ((maxBalance - val) / maxBalance) * 100;
          if (dd > maxDrawdown) maxDrawdown = dd;
        });

        setResults({
          totalTrades,
          wins,
          losses,
          winRate,
          netProfitPct,
          profitFactor,
          maxDrawdownPct: Number(maxDrawdown.toFixed(2)),
          initialBalance,
          finalBalance: Number(balance.toFixed(2)),
          equityCurve,
          trades: simulatedTrades
        });

      } catch (e: any) {
        alert("Failed to run backtest simulation. Please check formatting.");
      } finally {
        setLoading(false);
      }
    }, 1200);
  };

  const drawSvgEquityPath = (curve: number[]): string => {
    if (curve.length < 2) return "";
    const minVal = Math.min(...curve) * 0.98;
    const maxVal = Math.max(...curve) * 1.02;
    const range = maxVal - minVal;

    const width = 800;
    const height = 180;

    return curve.map((val, idx) => {
      const x = (idx / (curve.length - 1)) * width;
      const y = height - ((val - minVal) / range) * height;
      return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
    }).join(" ");
  };

  const downloadSampleTemplate = () => {
    const csvContentToDownload = `data:text/csv;charset=utf-8,${encodeURIComponent(PRELOADED_BTC_DATA)}`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", csvContentToDownload);
    downloadAnchor.setAttribute("download", "swing_backtester_template.csv");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg p-5 space-y-6 font-sans">
      
      {/* Module Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4 font-display">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-100 uppercase tracking-widest">Swing Trade Backtester</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Test and evaluate swing setups on 4H candles with wider risk bounds</p>
        </div>

        {/* Action Triggers */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={downloadSampleTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-xs text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer font-medium font-display"
          >
            <Download className="w-4 h-4" />
            <span>Format Spec</span>
          </button>
          
          <button
            onClick={parseAndRunBacktest}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-xs font-bold text-slate-950 rounded-lg active:scale-95 transition-all cursor-pointer shadow-indigo-500/10 hover:shadow-lg font-display"
            id="run-backtest-btn"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-slate-950" />
            )}
            <span>{loading ? "Simulating trades..." : "Run Swing Backtest"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* CSV input file or pasted container on left */}
        <div className="lg:col-span-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">1. Select Historical Candle CSV Source</label>
            
            <div className="p-4 bg-slate-950 rounded-xl border-2 border-dashed border-slate-800/80 hover:border-slate-700 text-center relative group transition-all">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-6 h-6 text-slate-500 mx-auto group-hover:text-cyan-400 transition-colors" />
              <span className="text-xs text-slate-300 font-medium block mt-2">
                {fileName !== "" ? fileName : "Upload bar history CSV"}
              </span>
              <span className="text-[10px] text-slate-650 mt-1 block">Supports .csv format with required headers</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">2. Or Paste Raw Comma Separated Strings</label>
              {pastedCsv && (
                <button
                  onClick={() => {
                    setPastedCsv("");
                    setCsvContent(PRELOADED_BTC_DATA);
                    setFileName("BTC_4H_Swing_Preset");
                  }}
                  className="text-[10px] text-rose-450 hover:underline cursor-pointer"
                >
                  Reset Preset
                </button>
              )}
            </div>
            <textarea
              rows={6}
              value={pastedCsv}
              onChange={handlePastChange}
              placeholder="timestamp,price,utbot,ema_crossover,rsi,macd,market_structure,volume..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 text-xs rounded-xl p-3 focus:outline-none text-slate-300 font-mono"
            />
          </div>
        </div>

        {/* Backtester Output Panel on Right */}
        <div className="lg:col-span-7 flex flex-col justify-between min-h-[300px] bg-slate-950/40 border border-slate-850 rounded-xl p-4.5">
          {results === null ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 py-12">
              <HelpCircle className="w-8 h-8 text-slate-700 mx-auto stroke-1" />
              <h4 className="text-xs uppercase tracking-wider font-bold text-slate-450 mt-3 font-display">Awaiting rules execution</h4>
              <p className="text-[11px] text-slate-600 mt-1 max-w-xs mx-auto">
                Configure your CSV inputs and click "Run Swing Backtest" to evaluate target settings.
              </p>
            </div>
          ) : (
            <div className="space-y-5 flex-1 flex flex-col justify-between">
              {/* Metric grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-slate-900/60 border border-slate-850 rounded-lg">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block">Total Trades</span>
                  <span className="text-lg font-black font-mono text-cyan-400 mt-0.5 block">{results.totalTrades}</span>
                </div>
                <div className="p-3 bg-slate-900/60 border border-slate-850 rounded-lg">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block">Win Rate</span>
                  <span className="text-lg font-black font-mono text-emerald-400 mt-0.5 block">{results.winRate}%</span>
                </div>
                <div className="p-3 bg-slate-900/60 border border-slate-850 rounded-lg">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block">Net Profit</span>
                  <span className={`text-lg font-black font-mono mt-0.5 block ${results.netProfitPct >= 0 ? "text-emerald-400" : "text-rose-450"}`}>
                    {results.netProfitPct >= 0 ? "+" : ""}{results.netProfitPct}%
                  </span>
                </div>
                <div className="p-3 bg-slate-900/60 border border-slate-850 rounded-lg">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block">Profit Factor</span>
                  <span className="text-lg font-black font-mono text-indigo-400 mt-0.5 block">{results.profitFactor}</span>
                </div>
              </div>

              {/* Vector graph SVG equity curve */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] text-slate-450 font-mono">
                  <span>Balance curve over history</span>
                  <span className="text-slate-550">Start: $10,000 · End: ${results.finalBalance.toLocaleString()}</span>
                </div>
                
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 flex items-center justify-center">
                  <svg className="w-full h-32 text-indigo-500" viewBox="0 0 800 180" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(99, 102, 241)" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="rgb(99, 102, 241)" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d={`${drawSvgEquityPath(results.equityCurve)} L 800 180 L 0 180 Z`}
                      fill="url(#eqGrad)"
                      stroke="none"
                    />
                    <path
                      d={drawSvgEquityPath(results.equityCurve)}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Detailed trade reports */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider font-display">Simulated Trade History</span>
                <div className="max-h-[140px] overflow-y-auto border border-slate-850 rounded-lg font-mono text-[10px] bg-slate-950/60 divide-y divide-slate-850">
                  {results.trades.length === 0 ? (
                    <div className="p-3 text-center text-slate-600">No entries recorded during this sequence.</div>
                  ) : (
                    results.trades.map(trade => (
                      <div key={trade.id} className="p-2.5 flex justify-between items-center hover:bg-slate-900/30 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-black px-1.5 rounded ${trade.side === "LONG" ? "bg-emerald-950 text-emerald-400 border border-emerald-500/10" : "bg-rose-950 text-rose-450 border border-rose-500/10"}`}>
                            {trade.side}
                          </span>
                          <span className="text-slate-300 font-bold">{trade.entryTime}</span>
                          <span className="text-slate-500">@{trade.entryPrice}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-550">Exit: {trade.exitTime}</span>
                          <span className={`font-bold ${trade.status === "WIN" ? "text-emerald-400" : "text-rose-455"}`}>
                            {trade.status === "WIN" ? "+" : ""}{trade.pnlPercentage}%
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
