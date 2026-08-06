import mongoose, { Schema, Document } from "mongoose";

// --- Config Schema ---
export interface IAppConfig extends Document {
  openAiKey: string;
  activeSymbols: string[];
  confidenceThreshold: number;
  telegramToken: string;
  telegramChatId: string;
  telegramEnabled: boolean;
  telegramApiUrl: string;
  confluenceWeights: any;
  filters: any;
  pollingEnabled: boolean;
  pollingIntervalSeconds: number;
  userCapital?: number;
  preferredCurrency?: "INR" | "USD";
}

const ConfigSchema = new Schema<IAppConfig>({
  openAiKey: { type: String, default: "" },
  activeSymbols: { type: [String], default: [] },
  confidenceThreshold: { type: Number, default: 45 },
  telegramToken: { type: String, default: "" },
  telegramChatId: { type: String, default: "" },
  telegramEnabled: { type: Boolean, default: false },
  telegramApiUrl: { type: String, default: "" },
  confluenceWeights: { type: Schema.Types.Mixed, default: {} },
  filters: { type: Schema.Types.Mixed, default: {} },
  pollingEnabled: { type: Boolean, default: false },
  pollingIntervalSeconds: { type: Number, default: 60 },
  userCapital: { type: Number },
  preferredCurrency: { type: String, enum: ["INR", "USD"] }
});

interface IConfigModel extends mongoose.Model<IAppConfig> {
  getSingleton(): Promise<IAppConfig>;
}

// Ensure a single document for config
ConfigSchema.statics.getSingleton = async function () {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({});
  }
  return config;
};

// --- Log Schema ---
export interface ILogEntry extends Document {
  id: string;
  timestamp: string;
  symbol: string;
  timeframe: string;
  price: number;
  payload: any;
  score: number;
  maxScore: number;
  passedFilters: boolean;
  filterResults: any;
  scoreBreakdown: any;
  aiDecision?: any;
  tradePlan?: any;
  telegramSent: boolean;
  telegramError?: string;
  formattedAlert?: string;
  multiTimeframe?: any[];
}

const LogSchema = new Schema<ILogEntry>({
  id: { type: String, required: true, unique: true },
  timestamp: { type: String, required: true },
  symbol: { type: String, required: true },
  timeframe: { type: String, required: true },
  price: { type: Number, required: true },
  payload: { type: Schema.Types.Mixed },
  score: { type: Number, required: true },
  maxScore: { type: Number, required: true },
  passedFilters: { type: Boolean, required: true },
  filterResults: { type: Schema.Types.Mixed },
  scoreBreakdown: { type: Schema.Types.Mixed },
  aiDecision: { type: Schema.Types.Mixed },
  tradePlan: { type: Schema.Types.Mixed },
  telegramSent: { type: Boolean, default: false },
  telegramError: { type: String },
  formattedAlert: { type: String },
  multiTimeframe: { type: [Schema.Types.Mixed] }
});

// --- Trade Schema ---
export interface ITradeHistoryEntry {
  timestamp: string;
  status: string;
  price: number;
  pnl: number;
  pnlPct: number;
  telegramSent: boolean;
  note: string;
}

export interface ITradeRecord extends Document {
  id: string;
  symbol: string;
  market: string;
  side: string;
  entryPrice: number;
  quantity: number;
  sl: number;
  tp1: number;
  tp2: number;
  entryDate: string;
  notes: string;
  currentPrice?: number;
  status?: string;
  pnl?: number;
  pnlPct?: number;
  lastUpdated?: string;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedStatus?: string;
  history: ITradeHistoryEntry[];
}

const TradeHistorySchema = new Schema<ITradeHistoryEntry>({
  timestamp: { type: String, required: true },
  status: { type: String, required: true },
  price: { type: Number, required: true },
  pnl: { type: Number, required: true },
  pnlPct: { type: Number, required: true },
  telegramSent: { type: Boolean, default: false },
  note: { type: String, required: true }
}, { _id: false });

const TradeSchema = new Schema<ITradeRecord>({
  id: { type: String, required: true, unique: true },
  symbol: { type: String, required: true },
  market: { type: String, required: true },
  side: { type: String, required: true },
  entryPrice: { type: Number, required: true },
  quantity: { type: Number, required: true },
  sl: { type: Number, required: true },
  tp1: { type: Number, required: true },
  tp2: { type: Number, required: true },
  entryDate: { type: String, required: true },
  notes: { type: String, default: "" },
  currentPrice: { type: Number },
  status: { type: String },
  pnl: { type: Number },
  pnlPct: { type: Number },
  lastUpdated: { type: String },
  isResolved: { type: Boolean, default: false },
  resolvedAt: { type: String },
  resolvedStatus: { type: String },
  history: { type: [TradeHistorySchema], default: [] }
});

export const Config = mongoose.model<IAppConfig, IConfigModel>("Config", ConfigSchema);
export const Log = mongoose.model<ILogEntry>("Log", LogSchema);
export const Trade = mongoose.model<ITradeRecord>("Trade", TradeSchema);

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("CRITICAL ERROR: MONGODB_URI is not set in the environment.");
    console.error("Shutting down to prevent ephemeral data loss.");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log("✅ Successfully connected to MongoDB Atlas");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
}
