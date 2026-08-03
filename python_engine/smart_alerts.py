"""
Institutional Smart Telegram Alert System
Formats and dispatches high-quality trade alerts to Telegram.
"""

import json
import urllib.request
import urllib.parse
from typing import Dict, Any, Optional

class SmartAlertSender:
    """Formats and dispatches institutional Telegram alerts."""

    @staticmethod
    def format_telegram_alert(trade_data: Dict[str, Any]) -> str:
        """Formats comprehensive trade parameters into a rich HTML Telegram alert."""
        symbol = trade_data.get("symbol", "BTCUSDT")
        side = trade_data.get("side", "LONG").upper()
        entry = trade_data.get("entry_price", 0.0)
        sl = trade_data.get("stop_loss", 0.0)
        tp1 = trade_data.get("tp1", 0.0)
        tp2 = trade_data.get("tp2", 0.0)
        rr = trade_data.get("risk_reward_ratio", 2.5)
        score = trade_data.get("confidence_score", 90)
        tier = trade_data.get("confidence_tier", "A+")
        smc_confirmations = trade_data.get("smc_confirmations", ["BOS", "Fair Value Gap (FVG)"])
        atr = trade_data.get("atr", 0.0)
        adx = trade_data.get("adx", 0.0)
        vol_ratio = trade_data.get("volume_ratio", 1.8)
        pos_size = trade_data.get("position_size", 0.0)
        reason = trade_data.get("reason_entry", "SMC + MTF Trend Confluence")

        direction_emoji = "📈 LONG" if side == "LONG" else "📉 SHORT"
        cur_symbol = "₹" if ".NS" in symbol else "$"

        smc_list_formatted = "\n".join([f"  • {c}" for c in smc_confirmations]) if smc_confirmations else "  • Structure & Trend Confluence"

        alert_html = f"""
🚨 <b>INSTITUTIONAL APEX-SMC TRADE SIGNAL</b> 🚨
━━━━━━━━━━━━━━━━━━━━━
📌 <b>Symbol:</b> <code>{symbol}</code>
{direction_emoji} | <b>Confidence Tier:</b> <b>{tier} ({score}/110 pts)</b>

💰 <b>EXECUTION LEVELS</b>
━━━━━━━━━━━━━━━━━━━━━
🟢 <b>Entry Price:</b> <code>{cur_symbol}{entry:,.4f}</code>
🔴 <b>Stop Loss:</b>   <code>{cur_symbol}{sl:,.4f}</code>
🎯 <b>Target 1:</b>    <code>{cur_symbol}{tp1:,.4f}</code> (50% scale out + Move SL to BE)
🎯 <b>Target 2:</b>    <code>{cur_symbol}{tp2:,.4f}</code> (Full Profit)
⚖️ <b>Risk/Reward:</b> <code>{rr:.2f}:1</code>

📊 <b>QUANT INDICATORS & CONFLUENCE</b>
━━━━━━━━━━━━━━━━━━━━━
⚡ <b>SMC Confirmations ({len(smc_confirmations)} Triggers):</b>
{smc_list_formatted}
📈 <b>ADX Trend Strength:</b> <code>{adx:.1f}</code>
📊 <b>Volume Expansion:</b> <code>{vol_ratio:.2f}x 20MA</code>
📐 <b>ATR (14):</b> <code>{atr:.4f}</code>
📦 <b>Dynamic Position Size:</b> <code>{pos_size:.4f} units</code> (1% Risk)

📋 <b>ENTRY RATIONALE</b>
<i>{reason}</i>

🤖 <i>ApexSMC Quant Bot • Institutional Execution System</i>
""".trim()
        return alert_html

    @staticmethod
    def send_alert(bot_token: str, chat_id: str, alert_html: str) -> Dict[str, Any]:
        """Dispatches HTML message via Telegram Bot API."""
        if not bot_token or not chat_id:
            return {"success": False, "error": "Telegram bot_token or chat_id not configured"}

        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": alert_html,
            "parse_mode": "HTML",
            "disable_web_page_preview": True
        }

        try:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                return {"success": True, "result": result}
        except Exception as e:
            return {"success": False, "error": str(e)}
