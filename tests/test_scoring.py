"""
Unit Tests for Scoring Engine & Quality Control
"""

import unittest
from python_engine.scoring_engine import ScoringEngine
from python_engine.risk_manager import RiskManager
from python_engine.ai_qc import AIQualityControl

class TestScoringAndRisk(unittest.TestCase):

    def test_weighted_scoring_engine(self):
        score_res = ScoringEngine.calculate_score(
            price=105.0,
            ema50=102.0,
            ema200=95.0,
            is_buy=True,
            market_structure={"trend": "bullish", "bos": True},
            volume_curr=1600.0,
            volume_ma=1000.0,
            rsi=38.0,
            macd_hist=1.5,
            smc_results={"has_min_smc": True, "smc_count": 3},
            atr=2.5,
            atr_min=1.0,
            risk_reward_ratio=3.0,
            mtf_results={"alignment_score": 10}
        )
        self.assertGreaterEqual(score_res["total_score"], 95)
        self.assertEqual(score_res["tier"], "Elite Trade")
        self.assertTrue(score_res["passed"])

    def test_dynamic_position_sizing(self):
        res = RiskManager.calculate_position_size(
            account_balance=10000.0,
            entry_price=100.0,
            stop_loss=95.0,
            risk_pct=1.0
        )
        self.assertEqual(res["risk_amount"], 100.0)
        self.assertEqual(res["position_size"], 20.0)
        self.assertEqual(res["position_value"], 2000.0)

    def test_ai_qc_reject(self):
        qc_res = AIQualityControl.audit_trade_setup(
            symbol="BTCUSDT",
            confidence_score=50.0,  # Below 65
            risk_reward_ratio=1.5,   # Below 2.0
            atr=0.5,
            atr_min=1.0,
            spread=0.0,
            max_spread=1.0,
            is_news_window=False,
            liquidity_ok=True,
            trend_clear=True,
            has_conflicting_signals=False,
            is_duplicate=False
        )
        self.assertFalse(qc_res["passed"])
        self.assertEqual(qc_res["decision"], "REJECT")
        self.assertGreaterEqual(len(qc_res["rejection_reasons"]), 2)

if __name__ == "__main__":
    unittest.main()
