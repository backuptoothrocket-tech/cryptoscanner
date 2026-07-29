export type AssetClass = "INDIAN_EQUITY" | "FOREX" | "CRYPTO";

export interface ConfluenceWeights {
  utbot: number;
  ema_crossover: number;
  rsi: number;
  macd: number;
  market_structure: number;
  volume: number;
  price_action?: number;
}

export interface FilterRules {
  rejectLowVolume: boolean;
  rejectAgainstEmaTrend: boolean;
  rejectRsiOverbought: boolean;
  requireStructureConfirmation: boolean;
}

export interface BotConfig {
  modelName: string;
  activeSymbols: string[];
  confidenceThreshold: number;
  telegramToken: string;
  telegramChatId: string;
  telegramEnabled: boolean;
  telegramApiUrl?: string;
  confluenceWeights: ConfluenceWeights;
  filters: FilterRules;
  pollingEnabled?: boolean;
  pollingIntervalSeconds?: number;
  userCapital?: number;
  preferredCurrency?: "INR" | "USD";
}

export interface TimeframeAnalysis {
  timeframe: string;
  trend: "bullish" | "bearish";
  utbot: "buy" | "sell" | "hold";
  structure: "BOS" | "CHOCH" | "none";
  rsi: "oversold" | "neutral" | "overbought";
  macd: "bullish_cross" | "bearish_cross" | "neutral";
  volume: "high" | "normal" | "low";
}

export interface LogEntry {
  id: string;
  timestamp: string;
  symbol: string;
  timeframe: string;
  price: number;
  payload: {
    symbol: string;
    timeframe: string;
    price: number;
    utbot: string;
    ema_crossover: string;
    rsi: string;
    macd: string;
    market_structure: string;
    volume: string;
    side?: "LONG" | "SHORT";
  };
  score: number;
  maxScore: number;
  passedFilters: boolean;
  filterResults: {
    lowVolume: boolean;
    againstTrend: boolean;
    rsiOverbought: boolean;
    noStructure: boolean;
  };
  scoreBreakdown: Record<string, number>;
  aiDecision?: {
    decision: "SEND" | "REJECT";
    confidence: number;
    reason: string;
  };
  tradePlan?: {
    entry: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    takeProfit3: number;
    riskRewardRatio: string;
  };
  telegramSent: boolean;
  telegramError?: string;
  formattedAlert?: string;
  multiTimeframe?: TimeframeAnalysis[];
}

export interface SimulatedSetup {
  symbol: string;
  price: number;
  score: number;
  volume: string;
  ema_crossover: string;
  utbot: string;
  rsi: string;
  macd: string;
  market_structure: string;
}

// ── Zerodha & Angel One Recommendation Types ──
export interface BrokerRecommendation {
  id: string;
  broker: "ZERODHA" | "ANGEL_ONE";
  symbol: string;
  name: string;
  assetClass: AssetClass;
  callSide: "BUY" | "SELL";
  productType: "MIS" | "CNC";
  timeframe: "INTRADAY" | "SWING";
  entryMin: number;
  entryMax: number;
  stopLoss: number;
  target1: number;
  target2: number;
  analystRating: "HIGH" | "MEDIUM" | "NEUTRAL";
  rationale: string;
  timestamp: string;
}

export interface BrokerConfluenceResult {
  broker: "ZERODHA" | "ANGEL_ONE";
  recommendation: BrokerRecommendation;
  alignmentStatus: "STRONG_CONFLUENCE" | "TRAP_WARNING" | "NEUTRAL_ALIGNED" | "DIVERGENCE";
  alignmentScore: number;
  notes: string;
}

// ── SMC Dual-Engine Execution Setup Types ──
export interface SMCExecutionSetup {
  mode: "INTRADAY" | "SWING";
  productType: "MIS" | "CNC/Delivery";
  timeframe: string;
  score: number;
  status: "QUALIFIED" | "DISQUALIFIED";
  disqualificationReason?: string;
  orderType: "LIMIT BUY" | "MARKET" | "DO NOT CHASE" | "LIMIT SELL";
  entryMin: number;
  entryMax: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskRewardRatio: number;
  formattedRiskReward: string;
  keyCatalyst: string;
  scoreBreakdown: {
    structure: number;
    volume: number;
    orderBlock: number;
    trendEma: number;
    relativeStrength: number;
    catalyst: number;
  };
}

export interface CapitalSizingRow {
  tradeMode: "Intraday" | "Swing";
  productType: "MIS" | "CNC/Delivery";
  executionEntry: number;
  maxShares: number;
  capitalUsed: number;
  maxRisk: number;
  target1Profit: number;
  currencySymbol: string;
}

export interface SMCDualReport {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  currency: "INR" | "USD";
  currencySymbol: string;
  tradingViewSymbol: string;
  livePrice: number;
  vwap: number;
  dailyLow: number;
  dailyHigh: number;
  atr14: number;
  isOverextended: boolean;
  intradaySetup: SMCExecutionSetup;
  swingSetup: SMCExecutionSetup;
  brokerConfluences: BrokerConfluenceResult[];
  capitalSizing: CapitalSizingRow[];
  timestamp: string;
}
