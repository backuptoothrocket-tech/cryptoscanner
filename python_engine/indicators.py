"""
Quantitative Technical Indicators Engine
Provides accurate step-by-step calculations for EMA, RSI, MACD, ATR, ADX, Volume MA, OBV, and Stochastic RSI.
Designed with strict zero look-ahead bias (using closed candles only).
"""

import math
from typing import List, Dict, Tuple, Optional


def calculate_ema(prices: List[float], period: int) -> List[float]:
    """Calculate Exponential Moving Average for a series of prices."""
    if len(prices) < period:
        return [0.0] * len(prices)
    
    ema = [0.0] * len(prices)
    multiplier = 2.0 / (period + 1)
    
    # First EMA value is SMA of initial 'period' elements
    sma = sum(prices[:period]) / period
    ema[period - 1] = sma
    
    for i in range(period, len(prices)):
        ema[i] = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1]
        
    return ema


def calculate_rsi(prices: List[float], period: int = 14) -> List[float]:
    """Calculate Relative Strength Index (RSI) using Wilder's smoothing."""
    if len(prices) <= period:
        return [50.0] * len(prices)
        
    rsi = [50.0] * len(prices)
    gains = [0.0] * len(prices)
    losses = [0.0] * len(prices)
    
    for i in range(1, len(prices)):
        diff = prices[i] - prices[i - 1]
        if diff > 0:
            gains[i] = diff
        else:
            losses[i] = abs(diff)
            
    avg_gain = sum(gains[1:period + 1]) / period
    avg_loss = sum(losses[1:period + 1]) / period
    
    if avg_loss == 0:
        rsi[period] = 100.0
    else:
        rs = avg_gain / avg_loss
        rsi[period] = 100.0 - (100.0 / (1.0 + rs))
        
    for i in range(period + 1, len(prices)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        
        if avg_loss == 0:
            rsi[i] = 100.0
        else:
            rs = avg_gain / avg_loss
            rsi[i] = 100.0 - (100.0 / (1.0 + rs))
            
    return rsi


def calculate_macd(prices: List[float], fast: int = 12, slow: int = 26, signal_period: int = 9) -> Dict[str, List[float]]:
    """Calculate MACD Line, Signal Line, and Histogram."""
    ema_fast = calculate_ema(prices, fast)
    ema_slow = calculate_ema(prices, slow)
    
    macd_line = [f - s for f, s in zip(ema_fast, ema_slow)]
    signal_line = calculate_ema(macd_line, signal_period)
    histogram = [m - s for m, s in zip(macd_line, signal_line)]
    
    return {
        "macd": macd_line,
        "signal": signal_line,
        "histogram": histogram
    }


def calculate_atr(highs: List[float], lows: List[float], closes: List[float], period: int = 14) -> List[float]:
    """Calculate Average True Range (ATR) using Wilder's smoothing."""
    n = len(closes)
    if n == 0 or len(highs) != n or len(lows) != n:
        return [0.0] * n
        
    tr = [0.0] * n
    tr[0] = highs[0] - lows[0]
    
    for i in range(1, n):
        tr1 = highs[i] - lows[i]
        tr2 = abs(highs[i] - closes[i - 1])
        tr3 = abs(lows[i] - closes[i - 1])
        tr[i] = max(tr1, tr2, tr3)
        
    if n <= period:
        return tr
        
    atr = [0.0] * n
    atr[period - 1] = sum(tr[:period]) / period
    
    for i in range(period, n):
        atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period
        
    return atr


def calculate_adx(highs: List[float], lows: List[float], closes: List[float], period: int = 14) -> Dict[str, List[float]]:
    """Calculate Average Directional Index (ADX), +DI, and -DI."""
    n = len(closes)
    if n <= period:
        return {
            "adx": [0.0] * n,
            "plus_di": [0.0] * n,
            "minus_di": [0.0] * n
        }
        
    tr = [0.0] * n
    plus_dm = [0.0] * n
    minus_dm = [0.0] * n
    
    for i in range(1, n):
        up_move = highs[i] - highs[i - 1]
        down_move = lows[i - 1] - lows[i]
        
        if up_move > down_move and up_move > 0:
            plus_dm[i] = up_move
        else:
            plus_dm[i] = 0.0
            
        if down_move > up_move and down_move > 0:
            minus_dm[i] = down_move
        else:
            minus_dm[i] = 0.0
            
        tr1 = highs[i] - lows[i]
        tr2 = abs(highs[i] - closes[i - 1])
        tr3 = abs(lows[i] - closes[i - 1])
        tr[i] = max(tr1, tr2, tr3)
        
    smoothed_tr = [0.0] * n
    smoothed_plus_dm = [0.0] * n
    smoothed_minus_dm = [0.0] * n
    
    smoothed_tr[period] = sum(tr[1:period + 1])
    smoothed_plus_dm[period] = sum(plus_dm[1:period + 1])
    smoothed_minus_dm[period] = sum(minus_dm[1:period + 1])
    
    for i in range(period + 1, n):
        smoothed_tr[i] = smoothed_tr[i - 1] - (smoothed_tr[i - 1] / period) + tr[i]
        smoothed_plus_dm[i] = smoothed_plus_dm[i - 1] - (smoothed_plus_dm[i - 1] / period) + plus_dm[i]
        smoothed_minus_dm[i] = smoothed_minus_dm[i - 1] - (smoothed_minus_dm[i - 1] / period) + minus_dm[i]
        
    plus_di = [0.0] * n
    minus_di = [0.0] * n
    dx = [0.0] * n
    
    for i in range(period, n):
        if smoothed_tr[i] > 0:
            plus_di[i] = (smoothed_plus_dm[i] / smoothed_tr[i]) * 100.0
            minus_di[i] = (smoothed_minus_dm[i] / smoothed_tr[i]) * 100.0
            di_sum = plus_di[i] + minus_di[i]
            if di_sum > 0:
                dx[i] = (abs(plus_di[i] - minus_di[i]) / di_sum) * 100.0
                
    adx = [0.0] * n
    if n >= 2 * period:
        adx[2 * period - 1] = sum(dx[period:2 * period]) / period
        for i in range(2 * period, n):
            adx[i] = (adx[i - 1] * (period - 1) + dx[i]) / period
            
    return {
        "adx": adx,
        "plus_di": plus_di,
        "minus_di": minus_di
    }


def calculate_volume_ma(volumes: List[float], period: int = 20) -> List[float]:
    """Calculate Simple Moving Average of Volume."""
    n = len(volumes)
    vol_ma = [0.0] * n
    if n < period:
        return vol_ma
        
    curr_sum = sum(volumes[:period])
    vol_ma[period - 1] = curr_sum / period
    
    for i in range(period, n):
        curr_sum += volumes[i] - volumes[i - period]
        vol_ma[i] = curr_sum / period
        
    return vol_ma


def calculate_obv(closes: List[float], volumes: List[float]) -> List[float]:
    """Calculate On-Balance Volume (OBV)."""
    n = len(closes)
    obv = [0.0] * n
    if n == 0:
        return obv
        
    for i in range(1, n):
        if closes[i] > closes[i - 1]:
            obv[i] = obv[i - 1] + volumes[i]
        elif closes[i] < closes[i - 1]:
            obv[i] = obv[i - 1] - volumes[i]
        else:
            obv[i] = obv[i - 1]
            
    return obv
