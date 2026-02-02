/**
 * TypeScript Type Definitions
 * ===========================
 * Central type definitions for the Market Predictor application.
 * These types complement the Prisma-generated types with additional
 * domain-specific interfaces.
 */

// ===========================================
// API Response Types
// ===========================================

/**
 * NewsAPI Article Response
 * Endpoint: GET /v2/everything
 */
export interface NewsAPIArticle {
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string; // ISO 8601
  content: string | null;
}

/**
 * NewsAPI Response
 */
export interface NewsAPIResponse {
  status: 'ok' | 'error';
  totalResults: number;
  articles: NewsAPIArticle[];
  code?: string;
  message?: string;
}

/**
 * Twitter/X API Tweet
 * Endpoint: GET /users/:id/tweets
 */
export interface XTweet {
  id: string;
  text: string;
  created_at: string; // ISO 8601
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    impression_count?: number;
  };
  entities?: {
    cashtags?: Array<{
      start: number;
      end: number;
      tag: string;
    }>;
    hashtags?: Array<{
      start: number;
      end: number;
      tag: string;
    }>;
    mentions?: Array<{
      start: number;
      end: number;
      username: string;
    }>;
  };
}

/**
 * X API Response
 */
export interface XTweetsResponse {
  data: XTweet[];
  meta: {
    result_count: number;
    newest_id: string;
    oldest_id: string;
    next_token?: string;
  };
}

// ===========================================
// Application Types
// ===========================================

/**
 * Sentiment values
 */
export type Sentiment = 'positive' | 'negative' | 'neutral';

/**
 * Prediction direction
 */
export type PredictionDirection = 'up' | 'down';

/**
 * Model type
 */
export type ModelType = 'fundamentals' | 'hype';

/**
 * News event categories
 */
export type EventCategory =
  | 'earnings'
  | 'regulation'
  | 'merger_acquisition'
  | 'product'
  | 'macro'
  | 'disaster'
  | 'legal'
  | 'executive'
  | 'other';

/**
 * Stock data with company info
 */
export interface StockWithCompany {
  ticker: string;
  name: string;
  sector: string | null;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

/**
 * Prediction with results
 */
export interface PredictionResult {
  ticker: string;
  companyName: string;
  modelType: ModelType;
  predictedDirection: PredictionDirection;
  confidence: number;
  targetDate: Date;
  actualDirection?: PredictionDirection | 'flat';
  actualChange?: number;
  wasCorrect?: boolean;
}

/**
 * Company with latest prediction
 */
export interface CompanyWithPrediction {
  ticker: string;
  name: string;
  sector: string | null;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  fundamentals: {
    direction: PredictionDirection;
    confidence: number;
  };
  hype: {
    direction: PredictionDirection;
    confidence: number;
  };
  wasCorrect: boolean | null;
}

/**
 * Model accuracy stats
 */
export interface ModelAccuracy {
  modelType: ModelType;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  byConfidenceBucket: {
    bucket: string; // "0-20%", "20-40%", etc.
    total: number;
    correct: number;
    accuracy: number;
  }[];
  bySector: {
    sector: string;
    total: number;
    correct: number;
    accuracy: number;
  }[];
}

/**
 * Claude news analysis response
 */
export interface ClaudeNewsAnalysis {
  summary: string;
  companies: {
    ticker: string;
    name: string;
    sentiment: Sentiment;
    confidence: number;
    reason: string;
  }[];
  category: EventCategory;
  importance: number; // 0-1
}

/**
 * Claude social post analysis response
 */
export interface ClaudeSocialAnalysis {
  companies: {
    ticker: string;
    sentiment: Sentiment;
    confidence: number;
  }[];
  overallSentiment: Sentiment;
  marketImpact: 'high' | 'medium' | 'low';
}

// ===========================================
// Sector Types
// ===========================================

/**
 * Available sectors
 */
export const SECTORS = [
  'Technology',
  'Finance',
  'Healthcare',
  'Consumer',
  'Energy',
  'Industrial',
] as const;

export type Sector = (typeof SECTORS)[number];

/**
 * Sector heat map data
 */
export interface SectorHeatMapData {
  sector: Sector;
  sentiment: number; // -1 to 1
  predictionCount: number;
  topMovers: {
    ticker: string;
    change: number;
  }[];
}

// ===========================================
// Dashboard Types
// ===========================================

/**
 * Dashboard stats
 */
export interface DashboardStats {
  fundamentalsAccuracy: number;
  hypeAccuracy: number;
  totalPredictions: number;
  todayPredictions: number;
  weeklyChange: {
    fundamentals: number;
    hype: number;
  };
}

/**
 * News event for display
 */
export interface NewsEventDisplay {
  id: string;
  title: string;
  summary: string;
  category: EventCategory;
  sentiment: Sentiment;
  importance: number;
  publishedAt: Date;
  affectedCompanies: string[];
}
