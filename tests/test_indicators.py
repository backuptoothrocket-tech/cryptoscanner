"""
Unit Tests for Indicator Calculations
"""

import unittest
from python_engine.indicators import (
    calculate_ema, calculate_rsi, calculate_macd,
    calculate_atr, calculate_adx, calculate_volume_ma
)

class TestIndicators(unittest.TestCase):

    def test_calculate_ema(self):
        prices = [10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 17.0, 18.0, 19.0]
        ema = calculate_ema(prices, 5)
        self.assertEqual(len(ema), len(prices))
        self.assertGreater(ema[-1], 0)
        self.assertAlmostEqual(ema[4], sum(prices[:5]) / 5)

    def test_calculate_rsi(self):
        prices = [100.0 + i * 2 for i in range(20)]  # Strictly rising
        rsi = calculate_rsi(prices, 14)
        self.assertEqual(len(rsi), len(prices))
        self.assertGreater(rsi[-1], 70.0)

    def test_calculate_atr(self):
        highs = [10.0 + i for i in range(20)]
        lows = [8.0 + i for i in range(20)]
        closes = [9.0 + i for i in range(20)]
        atr = calculate_atr(highs, lows, closes, 14)
        self.assertEqual(len(atr), len(closes))
        self.assertGreater(atr[-1], 0.0)

if __name__ == "__main__":
    unittest.main()
