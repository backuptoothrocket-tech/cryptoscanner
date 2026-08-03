"""
Institutional Trading System Configuration & Threshold Parameters
"""

# Risk Management Constants
RISK_PER_TRADE_PCT = 1.0        # 1% per trade account risk
MIN_RISK_REWARD_RATIO = 2.0     # Minimum 2:1 RR required
TARGET_RISK_REWARD_RATIO = 3.0  # Target 3:1+ RR
MAX_CORRELATED_TRADES = 2       # Max 2 simultaneous open positions on correlated pairs
MAX_DAILY_LOSS_PCT = 3.0        # 3% Max daily loss limit
MAX_WEEKLY_LOSS_PCT = 8.0       # 8% Max weekly loss limit
ATR_SL_MULTIPLIER = 1.2         # Stop loss distance = 1.2x ATR
ATR_TRAIL_MULTIPLIER = 1.5      # Trailing stop distance = 1.5x ATR

# Indicator Thresholds
VOLUME_MA_PERIOD = 20
VOLUME_THRESHOLD_RATIO = 1.5    # 1.5x 20-period volume MA
ADX_PERIOD = 14
ADX_MIN_THRESHOLD = 25.0        # ADX > 25 for trending markets
RSI_PERIOD = 14
EMA_FAST = 50
EMA_SLOW = 200

# Weighted Scoring Engine (Max 110 Points)
WEIGHT_TREND = 25
WEIGHT_MARKET_STRUCTURE = 20
WEIGHT_VOLUME = 15
WEIGHT_MOMENTUM = 15
WEIGHT_SMC = 15
WEIGHT_VOLATILITY = 5
WEIGHT_RISK_REWARD = 5
WEIGHT_HTF_ALIGNMENT = 10

MAX_SCORE = (
    WEIGHT_TREND +
    WEIGHT_MARKET_STRUCTURE +
    WEIGHT_VOLUME +
    WEIGHT_MOMENTUM +
    WEIGHT_SMC +
    WEIGHT_VOLATILITY +
    WEIGHT_RISK_REWARD +
    WEIGHT_HTF_ALIGNMENT
) # 110 Points

CONFIDENCE_TIERS = {
    "ELITE": (95, 110),
    "A_PLUS": (85, 94),
    "A": (75, 84),
    "B": (65, 74),
    "REJECT": (0, 64)
}

MIN_CONFIDENCE_SCORE = 65

# Telegram Notification Defaults
DEFAULT_TELEGRAM_BOT_TOKEN = ""
DEFAULT_TELEGRAM_CHAT_ID = ""
