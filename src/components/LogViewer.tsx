import React, { useState } from "react";
import { LogEntry } from "../types";
import { Database, Eye, Trash2, ShieldCheck, AlertTriangle, ChevronDown, ChevronUp, Copy, Check, MessageSquare } from "lucide-react";

interface LogViewerProps {
  logs: LogEntry[];
  onClear: () => void;
}

export default function LogViewer({ logs, onClear }: LogViewerProps) {
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleDetails = (id: string) => {
    setSelectedLogId(prev => (prev === id ? null : id));
  };

  const copyAlertToClipboard = (log: LogEntry, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg space-y-4 p-5 font-sans" id="log-viewer">
      {/* Logger Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-display">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">Evaluation Pipeline Logs</h3>
        </div>
        
        {logs.length > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-slate-400 hover:text-rose-400 text-xs px-2.5 py-1 rounded bg-slate-950/80 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-500/20 active:scale-95 transition-all cursor-pointer font-display"
            id="clear-logs-btn"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-12 bg-slate-950/40 rounded-lg border border-slate-800/50">
          <MessageSquare className="w-8 h-8 text-slate-600 mx-auto stroke-1" />
          <h4 className="text-slate-350 font-semibold text-xs uppercase tracking-wider mt-3">No Swing Signals Recorded</h4>
          <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
            Use the Alert Simulator in the active market tickers above or configure incoming webhook pipelines to see log records.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {logs.map((log) => {
            const isLong = log.payload?.side === "LONG";
            const sideColor = isLong ? "text-emerald-400 bg-emerald-950/30 border-emerald-500/10" : "text-rose-400 bg-rose-950/30 border-rose-500/10";
            const isPassed = log.passedFilters;
            const isExpanded = selectedLogId === log.id;

            return (
              <div
                key={log.id}
                className={`bg-slate-950/40 rounded-xl border border-slate-850 overflow-hidden hover:border-slate-800 transition-colors ${
                  isExpanded ? "border-slate-800 bg-slate-950/80" : ""
                }`}
              >
                {/* Row Summary Bar */}
                <div 
                  onClick={() => toggleDetails(log.id)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border ${sideColor} font-black`}>
                      {isLong ? "LONG 🚀" : "SHORT 🚨"}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-100 uppercase tracking-tight">{log.symbol}</span>
                        <span className="text-[10px] text-slate-500 font-mono">@{log.price.toLocaleString()}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString()} · Timeframe: {log.timeframe}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 justify-between sm:justify-end">
                    <div className="flex items-center gap-2">
                      {/* Rule score indicator */}
                      <div className="bg-slate-950 py-0.5 px-2 rounded border border-slate-850 text-right">
                        <span className="text-[9px] font-mono text-slate-500">Confluence: </span>
                        <span className="font-mono text-xs font-black text-cyan-400">{log.score}/{log.maxScore}</span>
                      </div>

                      {/* Filter result check status */}
                      {isPassed ? (
                        <div className="flex items-center gap-1 bg-emerald-950/30 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] text-emerald-400 font-semibold font-mono">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>PASSED</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 bg-rose-950/20 border border-rose-500/10 px-2 py-0.5 rounded text-[10px] text-rose-450 font-semibold font-mono">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                          <span>BLOCKED</span>
                        </div>
                      )}
                    </div>

                    <div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details section */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-slate-850/80 bg-slate-950/60 font-sans text-xs space-y-4 animate-fade-in">
                    
                    {/* Technical details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Scored Breakdown lists */}
                      <div className="bg-slate-900/50 p-4.5 rounded-xl border border-slate-850/80 space-y-3">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-850 pb-1.5 font-display">
                          Confluence Weights scoring
                        </h4>
                        <div className="space-y-1.5 font-mono text-[11px]">
                          {Object.entries(log.scoreBreakdown || {}).map(([key, score]) => (
                            <div key={key} className="flex justify-between items-center text-slate-350">
                              <span>• {key}:</span>
                              <span className={score > 0 ? "text-cyan-400 font-bold" : "text-slate-650"}>
                                +{score} pts
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Trade Plan & Risk parameters */}
                      {log.tradePlan && (
                        <div className="bg-slate-900/50 p-4.5 rounded-xl border border-slate-850/80 space-y-3">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-850 pb-1.5 font-display">
                            Trade setup execution plan
                          </h4>
                          
                          <div className="space-y-1.5 text-[11px] font-sans">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">Entry Target Price:</span>
                              <span className="font-mono text-slate-200 font-bold">${log.tradePlan.entry}</span>
                            </div>
                            <div className="flex justify-between items-center text-rose-400">
                              <span>Stop Loss (SL):</span>
                              <span className="font-mono font-bold">${log.tradePlan.stopLoss}</span>
                            </div>
                            <div className="flex justify-between items-center text-emerald-400">
                              <span>Take Profit 1 (TP1):</span>
                              <span className="font-mono font-bold">${log.tradePlan.takeProfit1}</span>
                            </div>
                            <div className="flex justify-between items-center text-emerald-400">
                              <span>Take Profit 2 (TP2):</span>
                              <span className="font-mono font-bold">${log.tradePlan.takeProfit2}</span>
                            </div>
                            <div className="flex justify-between items-center text-emerald-400">
                              <span>Take Profit 3 (TP3):</span>
                              <span className="font-mono font-bold">${log.tradePlan.takeProfit3}</span>
                            </div>
                            <div className="flex justify-between items-center border-t border-slate-850/60 pt-1 text-slate-400 text-[10px]">
                              <span>Risk Reward Ratio:</span>
                              <span className="font-mono font-bold text-cyan-400">{log.tradePlan.riskRewardRatio}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* AI analysis section */}
                    {log.aiDecision && (
                      <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-850/80 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-display">
                            AI Risk and Alignment Analysis
                          </span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            log.aiDecision.decision === "SEND" 
                              ? "bg-emerald-950/20 text-emerald-400" 
                              : "bg-rose-950/20 text-rose-450"
                          }`}>
                            AI Decision: {log.aiDecision.decision} ({log.aiDecision.confidence}% confidence)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 italic font-sans leading-relaxed">
                          "{log.aiDecision.reason}"
                        </p>
                      </div>
                    )}

                    {/* Compilation markdown message & Telegram status controls */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-850/80 text-[10px] font-mono text-slate-500">
                      <div className="flex items-center gap-2">
                        <span>Telegram dispatcher:</span>
                        {log.telegramSent ? (
                          <span className="text-emerald-400 font-bold">✓ DELIVERED</span>
                        ) : log.telegramError ? (
                          <span className="text-rose-450 font-bold">✕ BLOCKED: {log.telegramError}</span>
                        ) : (
                          <span className="text-slate-500">OFFLINE/DISABLED</span>
                        )}
                      </div>

                      {log.formattedAlert && (
                        <button
                          onClick={() => copyAlertToClipboard(log, log.formattedAlert!)}
                          className="px-2.5 py-1 bg-slate-900 border border-slate-800 text-slate-350 hover:text-white rounded hover:bg-slate-850 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedId === log.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Alert Template</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
