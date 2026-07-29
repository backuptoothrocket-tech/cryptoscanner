import React, { useState } from "react";
import { Copy, Check, Terminal, FileCode, Server } from "lucide-react";

export default function PythonCodeViewer() {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"bot" | "docker" | "requirements" | "arch">("bot");

  const pythonBotCode = `import os
import json
import sqlite3
import requests
from flask import Flask, request, jsonify
from google import genai
from google.genai import types

app = Flask(__name__)

# CONFIGURATION
DB_PATH = os.getenv("DB_PATH", "swing_alerts.db")
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
CONFIDENCE_THRESHOLD = int(os.getenv("CONFIDENCE_THRESHOLD", "70"))

# SQLITE INITIALIZATION
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS swing_logs (
            id TEXT PRIMARY KEY,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            symbol TEXT,
            timeframe TEXT,
            price REAL,
            score INTEGER,
            passed INTEGER,
            ai_confidence INTEGER,
            ai_reason TEXT,
            telegram_sent INTEGER
        )
    """)
    conn.commit()
    conn.close()

init_db()

def calculate_swing_risk(side, price):
    # Swing trading parameters: wider SL (4%) and 1:2.5+ targets
    sl_distance = price * 0.04
    
    if side == "buy":
        stop_loss = price - sl_distance
        risk = price - stop_loss
        tp1 = price + risk * 1.5
        tp2 = price + risk * 3.0
        tp3 = price + risk * 5.0
    else:
        stop_loss = price + sl_distance
        risk = stop_loss - price
        tp1 = price - risk * 1.5
        tp2 = price - risk * 3.0
        tp3 = price - risk * 5.0
        
    return {
        "sl": round(stop_loss, 2),
        "tp1": round(tp1, 2),
        "tp2": round(tp2, 2),
        "tp3": round(tp3, 2)
    }

def get_swing_confluence_score(payload):
    score = 0
    # 1. UT bot
    if payload.get("utbot") in ["buy", "sell"]:
        score += 30
    # 2. EMA Crossover
    if payload.get("ema_crossover") in ["bullish", "bearish"]:
        score += 25
    # 3. RSI
    if payload.get("rsi") in ["oversold", "overbought"]:
        score += 15
    # 4. MACD
    if payload.get("macd") in ["bullish_cross", "bearish_cross"]:
        score += 15
    # 5. BOS/CHOCH structure
    if payload.get("market_structure") in ["BOS", "CHOCH"]:
        score += 10
    # 6. Volume
    if payload.get("volume") == "high":
        score += 5
    return score

def query_gemini_ai(payload, score):
    if not GEMINI_API_KEY:
        return {"decision": "SEND" if score >= 70 else "REJECT", "confidence": score, "reason": "Evaluated offline: key missing"}
        
    client = genai.Client(api_key=GEMINI_API_KEY)
    prompt = f"Evaluate technical alignment swing trade: {json.dumps(payload)}. Combined indicator score is {score}/100."
    
    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "decision": types.Schema(type=types.Type.STRING, enum=["SEND", "REJECT"]),
                    "confidence": types.Schema(type=types.Type.INTEGER),
                    "reason": types.Schema(type=types.Type.STRING)
                },
                required=["decision", "confidence", "reason"]
            )
        )
    )
    return json.loads(response.text)

def dispatch_telegram(message):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return False
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {"chat_id": TELEGRAM_CHAT_ID, "text": message, "parse_mode": "HTML"}
    try:
        r = requests.post(url, json=payload, timeout=10)
        return r.json().get("ok", False)
    except Exception:
        return False

@app.route("/webhook", methods=["POST"])
def webhook():
    payload = request.json
    symbol = payload.get("symbol", "UNKNOWN")
    price = float(payload.get("price", 0))
    tf = payload.get("timeframe", "4H")
    utbot = payload.get("utbot", "hold")
    
    score = get_swing_confluence_score(payload)
    
    passed = 1 if score >= CONFIDENCE_THRESHOLD else 0
    if payload.get("volume") == "low":
        passed = 0
        
    ai_confidence = score
    ai_reason = "Manual rule validation"
    
    if passed == 1:
        ai_res = query_gemini_ai(payload, score)
        if ai_res.get("decision") == "REJECT":
            passed = 0
        ai_confidence = ai_res.get("confidence", score)
        ai_reason = ai_res.get("reason", "Swing structures fully aligned.")

    tg_sent = 0
    if passed == 1:
        side_label = "LONG 🚀" if utbot == "buy" or payload.get("rsi") == "oversold" else "SHORT 🚨"
        risk = calculate_swing_risk("buy" if "LONG" in side_label else "sell", price)
        
        tg_message = f"<b>SWING {side_label} SIGNAL</b>\\n\\n" \\
                     f"Symbol: {symbol}\\n" \\
                     f"Timeframe: {tf}\\n\\n" \\
                     f"AI Confidence: {ai_confidence}%\\n" \\
                     f"Confluence Score: {score}/100\\n\\n" \\
                     f"Entry price: {price}\\n" \\
                     f"Stop Loss: {risk['sl']}\\n" \\
                     f"Take Profit 1: {risk['tp1']}\\n" \\
                     f"Take Profit 2: {risk['tp2']}\\n" \\
                     f"Take Profit 3: {risk['tp3']}\\n\\n" \\
                     f"Reason: {ai_reason}"
                     
        if dispatch_telegram(tg_message):
            tg_sent = 1

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("""
            INSERT INTO swing_logs (id, symbol, timeframe, price, score, passed, ai_confidence, ai_reason, telegram_sent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (str(payload), symbol, tf, price, score, passed, ai_confidence, ai_reason, tg_sent))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Failed to log signal: {e}")
        
    return jsonify({"success": True, "score": score, "passed": bool(passed)})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)`;

  const dockerSetup = `version: '3.8'

services:
  alert-bot:
    build: .
    container_name: python-swing-alert-bot
    restart: always
    ports:
      - "5000:3000"
    environment:
      - TELEGRAM_TOKEN=your_telegram_bot_token
      - TELEGRAM_CHAT_ID=your_telegram_chat_id
      - GEMINI_API_KEY=your_gemini_api_key
      - CONFIDENCE_THRESHOLD=70
    volumes:
      - ./data:/app/data
`;

  const reqTxt = `flask==3.0.3
google-genai==2.4.0
requests==2.32.3
urllib3==2.2.1
`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg h-full flex flex-col font-sans" id="python-viewer">
      {/* Tab Navigation */}
      <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 font-display">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-200 tracking-wide uppercase">Standalone Daemon</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("bot")}
            className={`px-2.5 py-1 text-xs rounded-md transition-all ${
              activeTab === "bot" ? "bg-slate-800 text-cyan-400 border border-slate-700 font-medium" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            bot.py
          </button>
          <button
            onClick={() => setActiveTab("docker")}
            className={`px-2.5 py-1 text-xs rounded-md transition-all ${
              activeTab === "docker" ? "bg-slate-800 text-cyan-400 border border-slate-700 font-medium" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            docker-setup.yml
          </button>
          <button
            onClick={() => setActiveTab("requirements")}
            className={`px-2.5 py-1 text-xs rounded-md transition-all ${
              activeTab === "requirements" ? "bg-slate-800 text-cyan-400 border border-slate-700 font-medium" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            requirements.txt
          </button>
          <button
            onClick={() => setActiveTab("arch")}
            className={`px-2.5 py-1 text-xs rounded-md transition-all ${
              activeTab === "arch" ? "bg-slate-800 text-cyan-400 border border-slate-700 font-medium" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Architecture
          </button>
        </div>
      </div>

      {/* Code Display Area */}
      <div className="relative flex-1 bg-slate-950 p-4 font-mono text-[11px] md:text-sm overflow-auto text-slate-350 max-h-[400px]">
        {activeTab === "bot" && <pre className="whitespace-pre">{pythonBotCode}</pre>}
        {activeTab === "docker" && <pre className="whitespace-pre text-cyan-300">{dockerSetup}</pre>}
        {activeTab === "requirements" && <pre className="whitespace-pre text-emerald-450">{reqTxt}</pre>}
        {activeTab === "arch" && (
          <div className="space-y-4 font-sans text-xs text-slate-300 whitespace-normal p-1 select-text">
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" /> STANDALONE PRODUCTION BEST PRACTICES
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-900 border border-slate-850 rounded-lg">
                <span className="font-semibold text-cyan-400 block mb-1">🔒 Security Recommendations:</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px] leading-relaxed">
                  <li>Store API Keys in environment variables to prevent leakage.</li>
                  <li>Enable strict HTTPS/SSL on reverse proxy networks (e.g. NGINX).</li>
                  <li>Incorporate verification header keys inside alerts.</li>
                </ul>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-850 rounded-lg">
                <span className="font-semibold text-teal-400 block mb-1">📈 Scaling & database:</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px] leading-relaxed">
                  <li>Use task queues (Celery/Redis) to avoid thread locks under high loads.</li>
                  <li>Transition logs storage from SQLite to PostgreSQL for durability.</li>
                  <li>Use multi-threading for querying multiple coin APIs concurrently.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab !== "arch" && (
          <button
            onClick={() => copyToClipboard(activeTab === "bot" ? pythonBotCode : activeTab === "docker" ? dockerSetup : reqTxt)}
            className="absolute top-3 right-3 p-1.5 bg-slate-900/90 border border-slate-800 hover:bg-slate-800 rounded text-slate-450 hover:text-white transition-all flex items-center gap-1 cursor-pointer font-sans text-xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy code</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
