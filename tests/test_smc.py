"""
Unit Tests for Smart Money Concepts (SMC) & Market Structure
"""

import unittest
from python_engine.smc_analyzer import SMCAnalyzer

class TestSMCAnalyzer(unittest.TestCase):

    def test_fair_value_gap_detection(self):
        highs = [10.0, 11.0, 15.0]
        lows = [9.0, 10.5, 12.0]  # Bar 2 low (12.0) > Bar 0 high (10.0) -> Bullish FVG
        closes = [9.5, 10.8, 14.5]

        fvgs = SMCAnalyzer.detect_fair_value_gaps(highs, lows, closes)
        self.assertEqual(len(fvgs), 1)
        self.assertEqual(fvgs[0]["type"], "bullish")
        self.assertEqual(fvgs[0]["bottom"], 10.0)
        self.assertEqual(fvgs[0]["top"], 12.0)

    def test_premium_discount_zone(self):
        highs = [100.0 + i for i in range(50)]
        lows = [50.0 + i for i in range(50)]
        
        pd_discount = SMCAnalyzer.evaluate_premium_discount(highs, lows, 60.0)
        self.assertEqual(pd_discount["zone"], "discount")

        pd_premium = SMCAnalyzer.evaluate_premium_discount(highs, lows, 140.0)
        self.assertEqual(pd_premium["zone"], "premium")

if __name__ == "__main__":
    unittest.main()
