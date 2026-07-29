import React, { useState } from "react";
import { BotConfig, ConfluenceWeights, FilterRules } from "../types";
import { Settings, Shield, Sliders, BellRing, Save, RefreshCw } from "lucide-react";

interface ConfigFormProps {
  initialConfig: BotConfig;
  onSave: (config: BotConfig) => void;
}

export default function ConfigForm({ initialConfig, onSave }: ConfigFormProps) {
  const [config, setConfig] = useState<BotConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  React.useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  const handleWeightChange = (key: keyof ConfluenceWeights, val: number) => {
    setConfig(prev => ({
      ...prev,
      confluenceWeights: {
        ...prev.confluenceWeights,
        [key]: val,
      },
    }));
  };

  const handleFilterChange = (key: keyof FilterRules, checked: boolean) => {
    setConfig(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [key]: checked,
      },
    }));
  };

  const handleConfigChange = (key: keyof BotConfig, val: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        onSave(data.config);
      }
    } catch (err) {
      console.error("Failed to save config options", err);
    } finally {
      setSaving(false);
    }
  };

  const runTestNotification = async () => {
    if (!config.telegramToken || !config.telegramChatId) {
      setTestResult({
        success: false,
        message: "Please enter your Telegram Token and Chat ID to send a test message.",
      });
      return;
    }

    setTestLoading(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/test-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: config.telegramToken,
          chatId: config.telegramChatId,
          proxyUrl: config.telegramApiUrl || undefined,
        }),
      });
      const resJson = await response.json();
      if (resJson.success) {
        setTestResult({
          success: true,
          message: resJson.message,
        });
        setConfig(prev => ({
          ...prev,
          telegramToken: config.telegramToken,
          telegramChatId: config.telegramChatId,
          telegramEnabled: true
        }));
        if (resJson.config) {
          onSave(resJson.config);
        }
      } else {
        setTestResult({
          success: false,
          message: resJson.error || "Failed to trigger Connection Test dispatch.",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Failed to connect to backend validator",
      });
    } finally {
      setTestLoading(false);
    }
  };

  const totalWeight = Object.values(config.confluenceWeights).reduce((a: number, b: any) => a + (Number(b) || 0), 0);

  return (
    <form onSubmit={handleSave} className="space-y-6" id="config-form">
      {/* Configuration Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-slate-800 font-display">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-semibold text-slate-100 uppercase tracking-wider">Scalp Scanner Rules & Weights</h2>
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 font-semibold text-xs text-slate-950 rounded-lg shadow-md hover:shadow-cyan-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer font-display"
          disabled={saving}
          id="save-config-btn"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{saving ? "Saving configurations..." : "Apply Scalp Setup"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Confluence weight slider adjustments & thresholds */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <h3 className="text-xs font-bold text-cyan-400 tracking-wider uppercase flex items-center gap-1.5 border-b border-slate-800 pb-2 font-display">
              <Sliders className="w-4 h-4" /> Scalp Indicator Weights
            </h3>

            {/* Slider 1: UT Bot */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-200 font-medium">UT Bot Scalp Trigger</span>
                <span className="font-mono text-cyan-400 font-bold">{config.confluenceWeights.utbot} points</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={config.confluenceWeights.utbot}
                onChange={e => handleWeightChange("utbot", parseInt(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Slider 2: EMA Crossover */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-200 font-medium">Macro 50/200 EMA Trend Alignment</span>
                <span className="font-mono text-cyan-400 font-bold">{config.confluenceWeights.ema_crossover} points</span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                step="5"
                value={config.confluenceWeights.ema_crossover}
                onChange={e => handleWeightChange("ema_crossover", parseInt(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Slider 3: RSI */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-200 font-medium">RSI Overbought/Oversold Momentum</span>
                <span className="font-mono text-cyan-400 font-bold">{config.confluenceWeights.rsi} points</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="5"
                value={config.confluenceWeights.rsi}
                onChange={e => handleWeightChange("rsi", parseInt(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Slider 4: MACD */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-200 font-medium">MACD Trend/Signal line crossovers</span>
                <span className="font-mono text-cyan-400 font-bold">{config.confluenceWeights.macd} points</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="5"
                value={config.confluenceWeights.macd}
                onChange={e => handleWeightChange("macd", parseInt(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Slider 5: Market Structure */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-200 font-medium">Scalp Market Structure Breaks (BOS/CHOCH)</span>
                <span className="font-mono text-cyan-400 font-bold">{config.confluenceWeights.market_structure} points</span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                step="5"
                value={config.confluenceWeights.market_structure}
                onChange={e => handleWeightChange("market_structure", parseInt(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Slider 6: Volume */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-200 font-medium">Institutional Volume surge confirmation</span>
                <span className="font-mono text-cyan-400 font-bold">{config.confluenceWeights.volume} points</span>
              </div>
              <input
                type="range"
                min="0"
                max="15"
                step="5"
                value={config.confluenceWeights.volume}
                onChange={e => handleWeightChange("volume", parseInt(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Weight Status Tracker */}
            <div className="flex items-center justify-between text-xs px-3 py-2 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400 font-mono">Total Confluence Potential:</span>
              <span className={`font-mono font-bold ${totalWeight === 100 ? "text-emerald-400" : "text-amber-400"}`}>
                {totalWeight} / 100
              </span>
            </div>
          </div>

          {/* Filtering Threshold Boundary */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <h3 className="text-xs font-bold text-cyan-400 tracking-wider uppercase border-b border-slate-800 pb-2 font-display">
              Scoring Threshold Boundary
            </h3>
            
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-200 font-semibold uppercase">Min Confluence Pass Score</span>
                <span className="font-mono text-cyan-300 font-black text-sm">{config.confidenceThreshold} points</span>
              </div>
              <input
                type="range"
                min="20"
                max="95"
                step="5"
                value={config.confidenceThreshold}
                onChange={e => handleConfigChange("confidenceThreshold", parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <p className="text-[11px] text-slate-500">
                Setup alerts scoring lower than this threshold will be filtered out before AI analysis or dispatch.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Hard Block Rules & Telegram Settings */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <h3 className="text-xs font-bold text-cyan-400 tracking-wider uppercase flex items-center gap-1.5 border-b border-slate-800 pb-2 font-display">
              <Shield className="w-4 h-4" /> Algorithmic Filtering Rules
            </h3>

            <div className="space-y-3.5">
              {/* Filter 1 */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={config.filters.rejectLowVolume}
                  onChange={e => handleFilterChange("rejectLowVolume", e.target.checked)}
                  className="mt-1 rounded border-slate-800 bg-slate-950 text-cyan-400 focus:ring-cyan-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors">Discard setups on flat/low volume</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Blocks signals triggered without institutional volumetric backing.</p>
                </div>
              </label>

              {/* Filter 2 */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={config.filters.rejectAgainstEmaTrend}
                  onChange={e => handleFilterChange("rejectAgainstEmaTrend", e.target.checked)}
                  className="mt-1 rounded border-slate-800 bg-slate-950 text-cyan-400 focus:ring-cyan-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors">Enforce EMA macro trend alignment</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Filters out counter-trend setups pointing against the 50/200 EMA direction.</p>
                </div>
              </label>

              {/* Filter 3 */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={config.filters.rejectRsiOverbought}
                  onChange={e => handleFilterChange("rejectRsiOverbought", e.target.checked)}
                  className="mt-1 rounded border-slate-800 bg-slate-950 text-cyan-400 focus:ring-cyan-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors">Filter out RSI overbought/oversold extremes</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Blocks Long setups if RSI &gt;= 65 (preventing chasing), and Short setups if RSI &lt;= 35.</p>
                </div>
              </label>

              {/* Filter 4 */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={config.filters.requireStructureConfirmation}
                  onChange={e => handleFilterChange("requireStructureConfirmation", e.target.checked)}
                  className="mt-1 rounded border-slate-800 bg-slate-950 text-cyan-400 focus:ring-cyan-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors">Require structure breaks (BOS / CHOCH)</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Enforces that the price has broken local swing structures to validate entries.</p>
                </div>
              </label>
            </div>
          </div>

          {/* OpenAI ChatGPT Configuration */}
          <div className="bg-slate-900 border border-emerald-500/20 rounded-xl p-5 shadow-lg space-y-4">
            <h3 className="text-xs font-bold text-emerald-400 tracking-wider uppercase flex items-center gap-1.5 border-b border-slate-800 pb-2 font-display">
              🤖 ChatGPT AI Analysis (OpenAI)
              <span className="ml-auto px-2 py-0.5 bg-emerald-500/15 text-emerald-400 text-[10px] font-bold rounded border border-emerald-500/30">ACTIVE</span>
            </h3>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">OpenAI API Key</label>
              <input
                type="password"
                value={(config as any).openAiKey || ""}
                onChange={e => handleConfigChange("openAiKey" as any, e.target.value)}
                placeholder="sk-proj-..."
                className="w-full bg-slate-950 border border-slate-800 hover:border-emerald-500/40 focus:border-emerald-400 text-xs rounded-lg px-3 py-2 text-slate-200 focus:outline-none transition-all font-mono"
              />
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Your OpenAI key is stored locally only. Each trade alert sends one API call to <code className="text-emerald-400/80">gpt-4o-mini</code> (~$0.001).
              </p>
            </div>
          </div>

          {/* Telegram notifications configuration */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <h3 className="text-xs font-bold text-cyan-400 tracking-wider uppercase flex items-center gap-1.5 border-b border-slate-800 pb-2 font-display">
              <BellRing className="w-4 h-4" /> Telegram Alert Notification Node
            </h3>

            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.telegramEnabled}
                  onChange={e => handleConfigChange("telegramEnabled", e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-cyan-400 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-medium text-slate-200">Enable Telegram Alerts Dispatcher</span>
                </div>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Telegram Bot Token</label>
                  <input
                    type="password"
                    value={config.telegramToken}
                    onChange={e => handleConfigChange("telegramToken", e.target.value)}
                    placeholder="E.g. 7483120..."
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700/80 focus:border-cyan-400 text-xs rounded-lg px-3 py-2 text-slate-200 focus:outline-none transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Target Group/Chat ID</label>
                  <input
                    type="text"
                    value={config.telegramChatId}
                    onChange={e => handleConfigChange("telegramChatId", e.target.value)}
                    placeholder="E.g. -100472193..."
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700/80 focus:border-cyan-400 text-xs rounded-lg px-3 py-2 text-slate-200 focus:outline-none transition-all font-mono"
                  />
                </div>
              </div>

              {/* Telegram Proxy URL (for regions where api.telegram.org is blocked) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  API Proxy URL
                  <span className="px-1.5 py-0.5 bg-amber-500/15 text-amber-400 text-[10px] font-bold rounded border border-amber-500/30">OPTIONAL</span>
                </label>
                <input
                  type="text"
                  value={config.telegramApiUrl || ""}
                  onChange={e => handleConfigChange("telegramApiUrl", e.target.value)}
                  placeholder="Leave blank to use api.telegram.org directly"
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700/80 focus:border-amber-400 text-xs rounded-lg px-3 py-2 text-slate-200 focus:outline-none transition-all font-mono"
                />
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  If Telegram is blocked in your region, enter a proxy base URL (e.g. a Cloudflare Worker). 
                  The server will call <code className="text-amber-400/80">{"<proxy_url>"}/bot{"<token>"}/sendMessage</code>.
                </p>
              </div>

              {/* Bot Test Dispatch */}
              <div className="pt-3 border-t border-slate-800/60 mt-2">
                <button
                  type="button"
                  onClick={runTestNotification}
                  disabled={testLoading}
                  className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-850 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 hover:border-cyan-400/50 rounded-lg text-xs font-semibold cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 w-full font-display"
                  id="test-telegram-btn"
                >
                  {testLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <BellRing className="w-3.5 h-3.5" />
                  )}
                  <span>{testLoading ? "Delivering Connection Test..." : "Send Connection Test notification"}</span>
                </button>

                {testResult && (
                  <div className={`mt-3 p-3 text-xs rounded-lg border ${
                    testResult.success
                      ? "bg-emerald-900/15 border-emerald-500/20 text-emerald-300"
                      : "bg-rose-900/15 border-rose-500/20 text-rose-300"
                  }`}>
                    <p className="leading-relaxed font-mono">{testResult.message}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
