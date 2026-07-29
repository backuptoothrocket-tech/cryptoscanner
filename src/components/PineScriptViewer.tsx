import React, { useState } from "react";
import { Copy, Check, Code, Terminal } from "lucide-react";

export default function PineScriptViewer() {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"indicator" | "payload">("indicator");

  const pineCode = `//@version=5
indicator("AI Swing Trade Scanner Triggers (EMA/RSI/MACD)", overlay=true)

// --- EMAS INPUTS ---
ema50_len = input.int(50, title="EMA Fast Length")
ema200_len = input.int(200, title="EMA Slow Length")

// --- EMAS CALCULATIONS ---
ema50 = ta.ema(close, ema50_len)
ema200 = ta.ema(close, ema200_len)
emaTrend = ema50 > ema200 ? "bullish" : "bearish"

plot(ema50, color=color.cyan, linewidth=1.5, title="50 EMA")
plot(ema200, color=color.indigo, linewidth=2, title="200 EMA")

// --- RSI INPUTS ---
rsi_len = input.int(14, title="RSI Length")
rsi_val = ta.rsi(close, rsi_len)
rsiState = rsi_val <= 35 ? "oversold" : rsi_val >= 65 ? "overbought" : "neutral"

// --- MACD INPUTS ---
fast_macd = input.int(12, title="MACD Fast Length")
slow_macd = input.int(26, title="MACD Slow Length")
signal_macd = input.int(9, title="MACD Signal Length")

[macdLine, signalLine, histLine] = ta.macd(close, fast_macd, slow_macd, signal_macd)
macdState = ta.crossover(macdLine, signalLine) ? "bullish_cross" : ta.crossunder(macdLine, signalLine) ? "bearish_cross" : "neutral"

// --- UT BOT TRIGGER (FAST OSCILLATOR CROSS) ---
src = input.source(close, title="UT Bot Source")
keyValue = input.float(3.0, title="UT Bot Key Value") // higher value for swing
atrPeriod = input.int(10, title="UT Bot ATR Period")

var float trailing_stop = na
var bool is_long = false
xATR = ta.atr(atrPeriod)
xEMA = ta.ema(src, 1)

atr_delta = keyValue * xATR
long_stop = close - atr_delta
short_stop = close + atr_delta

trailing_stop := is_long ? math.max(long_stop, nz(trailing_stop[1], long_stop)) : math.min(short_stop, nz(trailing_stop[1], short_stop))

if ta.crossover(close, trailing_stop)
    is_long := true
if ta.crossunder(close, trailing_stop)
    is_long := false

ut_buy = is_long and not nz(is_long[1], false)
ut_sell = not is_long and nz(is_long[1], true)

plotshape(ut_buy, title="Buy Trigger", style=shape.triangleup, location=location.belowbar, color=color.emerald, size=size.small)
plotshape(ut_sell, title="Sell Trigger", style=shape.triangledown, location=location.abovebar, color=color.rose, size=size.small)

// --- MARKET STRUCTURE (BOS/CHOCH) ---
var string structure_state = "None"
high_swing = ta.highest(high, 20)
low_swing = ta.lowest(low, 20)

if ta.crossover(close, high_swing[1])
    structure_state := "BOS"
else if ta.crossunder(close, low_swing[1])
    structure_state := "CHOCH"

// --- VOLUME CONFIRMATION ---
vol_avg = ta.sma(volume, 20)
vol_state = volume > vol_avg * 1.5 ? "high" : volume < vol_avg * 0.5 ? "low" : "normal"

// --- ALERT DISPATCH TRIGGER ---
alert_payload = '{"symbol": "' + syminfo.ticker + '", "timeframe": "' + timeframe.period + '", "price": ' + str.tostring(close) + ', "utbot": "' + (ut_buy ? "buy" : ut_sell ? "sell" : "hold") + '", "ema_crossover": "' + emaTrend + '", "rsi": "' + rsiState + '", "macd": "' + macdState + '", "market_structure": "' + structure_state + '", "volume": "' + vol_state + '"}'

// Dispatch only on swing triggers
if ut_buy or ut_sell or ta.crossover(macdLine, signalLine) or rsi_val <= 35
    alert(alert_payload, alert.freq_once_per_bar_close)
`;

  const payloadDoc = `{
  "symbol": "BTCUSDT",
  "timeframe": "4H",
  "price": 104250,
  "utbot": "buy",
  "ema_crossover": "bullish",
  "rsi": "oversold",
  "macd": "bullish_cross",
  "market_structure": "BOS",
  "volume": "high"
}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg h-full flex flex-col font-sans" id="pinescript-viewer">
      {/* Header Tabs */}
      <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex items-center justify-between font-display">
        <div className="flex items-center gap-1.5">
          <Code className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-200 tracking-wide uppercase">TradingView Setup</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("indicator")}
            className={`px-3 py-1 text-xs rounded-md transition-all ${
              activeTab === "indicator"
                ? "bg-slate-800 text-cyan-400 font-medium border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Pine Script v5
          </button>
          <button
            onClick={() => setActiveTab("payload")}
            className={`px-3 py-1 text-xs rounded-md transition-all ${
              activeTab === "payload"
                ? "bg-slate-800 text-cyan-400 font-medium border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Payload Spec
          </button>
        </div>
      </div>

      {/* Code Area */}
      <div className="relative flex-1 bg-slate-950 p-4 font-mono text-[11px] md:text-xs overflow-auto text-slate-350 select-all max-h-[420px]">
        {activeTab === "indicator" ? (
          <pre className="whitespace-pre">{pineCode}</pre>
        ) : (
          <pre className="whitespace-pre text-cyan-300">{payloadDoc}</pre>
        )}

        <button
          onClick={() => copyToClipboard(activeTab === "indicator" ? pineCode : payloadDoc)}
          className="absolute top-3 right-3 p-1.5 bg-slate-900/90 border border-slate-800 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-all flex items-center gap-1 cursor-pointer font-sans text-xs"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] text-emerald-400 pr-1">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="text-[10px] pr-1">Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* Guide Footer */}
      <div className="bg-slate-950/40 p-3.5 border-t border-slate-800/80 text-xs text-slate-450">
        <div className="flex items-start gap-2.5">
          <div className="bg-cyan-500/10 p-1 rounded text-cyan-400 mt-0.5 font-bold font-mono">1</div>
          <div>
            <p className="font-semibold text-slate-300">Setting up TradingView Webhook:</p>
            <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed font-sans">
              Create an indicator in the <span className="font-mono text-cyan-400">Pine Editor</span>, click "Add to Chart", create a 4H or 1D alert, set the Webhook URL to our listener, and inside the Message field enter: <code className="bg-slate-900 border border-slate-800 px-1 rounded text-cyan-300">{"{{alert_message}}"}</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
