/**
 * Stock Data Service
 * ==================
 * Fetches stock-specific data including predictions, news, and price history.
 *
 * Usage:
 *   import { stockData } from '@/services/stock-data';
 *   const data = await stockData.getStockDetails('AAPL');
 */

import { db } from '@/lib/db';

// ===========================================
// Types
// ===========================================

export interface StockDetails {
  company: {
    id: string;
    ticker: string;
    name: string;
    sector: string | null;
    industry: string | null;
    marketCap: number | null;
  };
  latestPrice: {
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: bigint;
    change: number;
    changePercent: number;
  } | null;
  predictions: {
    fundamentals: StockPrediction | null;
    hype: StockPrediction | null;
  };
  accuracy: {
    fundamentals: { total: number; correct: number; accuracy: number };
    hype: { total: number; correct: number; accuracy: number };
  };
  priceHistory: PricePoint[];
  recentNews: NewsItem[];
  recentSocial: SocialItem[];
}

export interface StockPrediction {
  id: string;
  predictionDate: Date;
  targetDate: Date;
  predictedDirection: 'up' | 'down';
  confidence: number;
  newsImpactScore: number | null;
  socialImpactScore: number | null;
  actualDirection: string | null;
  actualChange: number | null;
  wasCorrect: boolean | null;
}

export interface PricePoint {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: bigint;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  publishedAt: Date;
  sentiment: string;
  impactScore: number;
}

export interface SocialItem {
  id: string;
  accountName: string;
  accountHandle: string;
  platform: string;
  content: string;
  publishedAt: Date;
  sentiment: string | null;
  impactScore: number | null;
}

// ===========================================
// Main Functions
// ===========================================

/**
 * Get company by ticker
 */
export async function getCompanyByTicker(ticker: string) {
  return db.company.findUnique({
    where: { ticker: ticker.toUpperCase() },
  });
}

/**
 * Get latest stock price
 */
export async function getLatestPrice(companyId: string) {
  const prices = await db.stockPrice.findMany({
    where: { companyId },
    orderBy: { date: 'desc' },
    take: 2,
  });

  if (prices.length === 0) return null;

  const latest = prices[0];
  const previous = prices[1];

  const change = previous ? latest.close - previous.close : 0;
  const changePercent = previous ? (change / previous.close) * 100 : 0;

  return {
    date: latest.date,
    open: latest.open,
    high: latest.high,
    low: latest.low,
    close: latest.close,
    volume: latest.volume,
    change,
    changePercent,
  };
}

/**
 * Get latest predictions for both models
 */
export async function getLatestPredictions(companyId: string) {
  const [fundamentals, hype] = await Promise.all([
    db.prediction.findFirst({
      where: { companyId, modelType: 'fundamentals' },
      orderBy: { targetDate: 'desc' },
    }),
    db.prediction.findFirst({
      where: { companyId, modelType: 'hype' },
      orderBy: { targetDate: 'desc' },
    }),
  ]);

  return {
    fundamentals: fundamentals
      ? {
          id: fundamentals.id,
          predictionDate: fundamentals.predictionDate,
          targetDate: fundamentals.targetDate,
          predictedDirection: fundamentals.predictedDirection as 'up' | 'down',
          confidence: fundamentals.confidence,
          newsImpactScore: fundamentals.newsImpactScore,
          socialImpactScore: fundamentals.socialImpactScore,
          actualDirection: fundamentals.actualDirection,
          actualChange: fundamentals.actualChange,
          wasCorrect: fundamentals.wasCorrect,
        }
      : null,
    hype: hype
      ? {
          id: hype.id,
          predictionDate: hype.predictionDate,
          targetDate: hype.targetDate,
          predictedDirection: hype.predictedDirection as 'up' | 'down',
          confidence: hype.confidence,
          newsImpactScore: hype.newsImpactScore,
          socialImpactScore: hype.socialImpactScore,
          actualDirection: hype.actualDirection,
          actualChange: hype.actualChange,
          wasCorrect: hype.wasCorrect,
        }
      : null,
  };
}

/**
 * Get historical accuracy for a stock
 */
export async function getStockAccuracy(companyId: string) {
  const [fundamentalsPreds, hypePreds] = await Promise.all([
    db.prediction.findMany({
      where: { companyId, modelType: 'fundamentals', wasCorrect: { not: null } },
      select: { wasCorrect: true },
    }),
    db.prediction.findMany({
      where: { companyId, modelType: 'hype', wasCorrect: { not: null } },
      select: { wasCorrect: true },
    }),
  ]);

  const calcAccuracy = (preds: { wasCorrect: boolean | null }[]) => {
    const evaluated = preds.filter((p) => p.wasCorrect !== null);
    const correct = evaluated.filter((p) => p.wasCorrect === true).length;
    return {
      total: evaluated.length,
      correct,
      accuracy: evaluated.length > 0 ? (correct / evaluated.length) * 100 : 0,
    };
  };

  return {
    fundamentals: calcAccuracy(fundamentalsPreds),
    hype: calcAccuracy(hypePreds),
  };
}

/**
 * Get price history for charting
 */
export async function getPriceHistory(companyId: string, days: number = 30): Promise<PricePoint[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const prices = await db.stockPrice.findMany({
    where: {
      companyId,
      date: { gte: startDate },
    },
    orderBy: { date: 'asc' },
  });

  return prices.map((p) => ({
    date: p.date,
    open: p.open,
    high: p.high,
    low: p.low,
    close: p.close,
    volume: p.volume,
  }));
}

/**
 * Get recent news impacting this stock
 */
export async function getRecentNews(companyId: string, limit: number = 10): Promise<NewsItem[]> {
  const impacts = await db.newsImpact.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      article: {
        select: {
          id: true,
          title: true,
          summary: true,
          url: true,
          sourceId: true,
          publishedAt: true,
        },
      },
    },
  });

  return impacts
    .filter((i) => i.article)
    .map((i) => ({
      id: i.article!.id,
      title: i.article!.title,
      summary: i.article!.summary,
      url: i.article!.url,
      source: i.article!.sourceId,
      publishedAt: i.article!.publishedAt,
      sentiment: i.sentiment,
      impactScore: i.impactScore,
    }));
}

/**
 * Get recent social mentions for this stock
 */
export async function getRecentSocial(companyId: string, limit: number = 10): Promise<SocialItem[]> {
  const mentions = await db.socialMention.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      post: {
        include: {
          account: {
            select: {
              name: true,
              handle: true,
              platform: true,
            },
          },
        },
      },
    },
  });

  return mentions.map((m) => ({
    id: m.post.id,
    accountName: m.post.account.name,
    accountHandle: m.post.account.handle,
    platform: m.post.account.platform,
    content: m.post.content,
    publishedAt: m.post.publishedAt,
    sentiment: m.sentiment,
    impactScore: m.post.impactScore,
  }));
}

/**
 * Get all stock details for the detail page
 */
export async function getStockDetails(ticker: string): Promise<StockDetails | null> {
  const company = await getCompanyByTicker(ticker);
  if (!company) return null;

  const [latestPrice, predictions, accuracy, priceHistory, recentNews, recentSocial] =
    await Promise.all([
      getLatestPrice(company.id),
      getLatestPredictions(company.id),
      getStockAccuracy(company.id),
      getPriceHistory(company.id, 30),
      getRecentNews(company.id, 10),
      getRecentSocial(company.id, 10),
    ]);

  return {
    company: {
      id: company.id,
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      industry: company.industry,
      marketCap: company.marketCap,
    },
    latestPrice,
    predictions,
    accuracy,
    priceHistory,
    recentNews,
    recentSocial,
  };
}

/**
 * Get all active companies for listing
 */
export async function getAllCompanies() {
  return db.company.findMany({
    where: { isActive: true },
    orderBy: { ticker: 'asc' },
    select: {
      id: true,
      ticker: true,
      name: true,
      sector: true,
    },
  });
}

// Export as namespace
export const stockData = {
  getCompanyByTicker,
  getLatestPrice,
  getLatestPredictions,
  getStockAccuracy,
  getPriceHistory,
  getRecentNews,
  getRecentSocial,
  getStockDetails,
  getAllCompanies,
};
