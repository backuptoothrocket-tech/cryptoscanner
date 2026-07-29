import React from "react";
import { Check, Copy, Radio, ShieldCheck, Cpu } from "lucide-react";

interface TelemetryStatusProps {
  hasGeminiKey: boolean;
  webhookCount: number;
  pollingEnabled?: boolean;
}

export default function TelemetryStatus({ webhookCount, pollingEnabled }: TelemetryStatusProps) {
  const [copied, setCopied]           = React.useState(false);
  const [showWebhook, setShowWebhook] = React.useState(false);
  const webhookUrl = `${window.location.origin}/api/webhook`;

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      style={{ background: "rgba(10,14,22,0.9)", border: "1px solid rgba(255,255,255,0.06)" }}
      id="telemetry-status">

      {/* Left: status */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <span className="flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white">
              {pollingEnabled ? "Headless Daemon Active" : "Webhook Listener Online"}
            </span>
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(6,182,212,0.08)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.15)" }}>
              {pollingEnabled ? "DAEMON" : "WEBHOOK"}
            </span>
          </div>
          <p className="text-[10px] text-slate-600 mt-0.5">
            {pollingEnabled
              ? "Server scanning 4H candles · EMA/RSI/MACD evaluations running"
              : "Awaiting Pine script webhooks from TradingView on /api/webhook"}
          </p>
        </div>
      </div>

      {/* Right: badges + toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span className="text-[10px] font-bold text-slate-400">Signals: <span className="text-white font-mono">{webhookCount}</span></span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <Cpu className="w-3 h-3 text-indigo-400" />
          <span className="text-[10px] font-bold text-indigo-400">Gemini 3.5</span>
        </div>
        <button onClick={() => setShowWebhook(!showWebhook)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all hover:text-cyan-400"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#64748b" }}>
          <Radio className="w-3 h-3" />
          {showWebhook ? "Hide URL" : "Webhook URL"}
        </button>
      </div>

      {/* Webhook URL reveal */}
      {showWebhook && (
        <div className="w-full sm:col-span-2 mt-1 pt-3 animate-fade-in"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <code className="flex-1 text-[11px] font-mono text-slate-400 select-all truncate">{webhookUrl}</code>
            <button onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-all shrink-0"
              style={{
                background: copied ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)",
                color: copied ? "#10b981" : "#94a3b8",
                border: `1px solid ${copied ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.08)"}`
              }}>
              {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
          </div>
          <p className="text-[9px] text-slate-700 mt-1.5 font-mono">
            TradingView webhooks require a paid subscription. Use the Daemon mode for free scanning.
          </p>
        </div>
      )}
    </div>
  );
}
