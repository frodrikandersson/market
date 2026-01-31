/**
 * Sector Data Service
 * ====================
 * Fetches sector-level aggregations for heat map visualization.
 *
 * Usage:
 *   import { sectorData } from '@/services/sector-data';
 *   const data = await sectorData.getSectorOverview();
 */

import { db } from '@/lib/db';

// ===========================================
// Types
// ===========================================

export interface SectorSummary {
  sector: string;
  companyCount: number;
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
    overall: 'positive' | 'negative' | 'neutral';
    score: number; // -1 to 1
  };
  predictions: {
    up: number;
    down: number;
    fundamentalsAccuracy: number;
    hypeAccuracy: number;
  };
  topMovers: {
    ticker: string;
    name: string;
    prediction: 'up' | 'down';
    confidence: number;
  }[];
  recentNews: number;
}

export interface SectorDetails {
  sector: string;
  companies: {
    ticker: string;
    name: string;
    latestPrice: number | null;
    priceChange: number | null;
    fundamentalsPrediction: 'up' | 'down' | null;
    fundamentalsConfidence: number | null;
    hypePrediction: 'up' | 'down' | null;
    hypeConfidence: number | null;
    recentSentiment: string | null;
  }[];
  accuracy: {
    fundamentals: { total: number; correct: number; accuracy: number };
    hype: { total: number; correct: number; accuracy: number };
  };
  recentNews: {
    title: string;
    ticker: string;
    sentiment: string;
    publishedAt: Date;
  }[];
}

// ===========================================
// Main Functions
// ===========================================

/**
 * Get all sectors with summary data
 */
export async function getSectorOverview(): Promise<SectorSummary[]> {
  // Get all companies grouped by sector
  const companies = await db.company.findMany({
    where: { isActive: true, sector: { not: null } },
    select: {
      id: true,
      ticker: true,
      name: true,
      sector: true,
    },
  });

  // Get sectors list
  const sectors = [...new Set(companies.map((c) => c.sector!))].sort();

  // Get recent predictions and news impacts
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [predictions, newsImpacts] = await Promise.all([
    db.prediction.findMany({
      where: {
        targetDate: { gte: thirtyDaysAgo },
      },
      include: {
        company: {
          select: { sector: true, ticker: true, name: true },
        },
      },
    }),
    db.newsImpact.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
      include: {
        company: {
          select: { sector: true },
        },
      },
    }),
  ]);

  // Aggregate by sector
  const result: SectorSummary[] = [];

  for (const sector of sectors) {
    const sectorCompanies = companies.filter((c) => c.sector === sector);
    const sectorPredictions = predictions.filter((p) => p.company.sector === sector);
    const sectorNewsImpacts = newsImpacts.filter((n) => n.company.sector === sector);

    // Calculate sentiment
    const positiveNews = sectorNewsImpacts.filter((n) => n.sentiment === 'positive').length;
    const negativeNews = sectorNewsImpacts.filter((n) => n.sentiment === 'negative').length;
    const neutralNews = sectorNewsImpacts.filter((n) => n.sentiment === 'neutral').length;
    const totalNews = positiveNews + negativeNews + neutralNews;

    const sentimentScore =
      totalNews > 0 ? (positiveNews - negativeNews) / totalNews : 0;

    // Calculate predictions
    const upPredictions = sectorPredictions.filter(
      (p) => p.predictedDirection === 'up'
    ).length;
    const downPredictions = sectorPredictions.filter(
      (p) => p.predictedDirection === 'down'
    ).length;

    // Calculate accuracy
    const fundamentalsPreds = sectorPredictions.filter(
      (p) => p.modelType === 'fundamentals' && p.wasCorrect !== null
    );
    const hypePreds = sectorPredictions.filter(
      (p) => p.modelType === 'hype' && p.wasCorrect !== null
    );

    const fundamentalsCorrect = fundamentalsPreds.filter((p) => p.wasCorrect).length;
    const hypeCorrect = hypePreds.filter((p) => p.wasCorrect).length;

    // Get top movers (highest confidence predictions)
    const latestPredictions = sectorPredictions
      .filter((p) => p.wasCorrect === null) // Only pending predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    result.push({
      sector,
      companyCount: sectorCompanies.length,
      sentiment: {
        positive: positiveNews,
        negative: negativeNews,
        neutral: neutralNews,
        overall:
          sentimentScore > 0.1 ? 'positive' : sentimentScore < -0.1 ? 'negative' : 'neutral',
        score: sentimentScore,
      },
      predictions: {
        up: upPredictions,
        down: downPredictions,
        fundamentalsAccuracy:
          fundamentalsPreds.length > 0
            ? (fundamentalsCorrect / fundamentalsPreds.length) * 100
            : 0,
        hypeAccuracy:
          hypePreds.length > 0 ? (hypeCorrect / hypePreds.length) * 100 : 0,
      },
      topMovers: latestPredictions.map((p) => ({
        ticker: p.company.ticker,
        name: p.company.name,
        prediction: p.predictedDirection as 'up' | 'down',
        confidence: p.confidence,
      })),
      recentNews: totalNews,
    });
  }

  // Sort by company count descending
  result.sort((a, b) => b.companyCount - a.companyCount);

  return result;
}

/**
 * Get detailed data for a specific sector
 */
export async function getSectorDetails(sector: string): Promise<SectorDetails | null> {
  const companies = await db.company.findMany({
    where: { sector, isActive: true },
    select: {
      id: true,
      ticker: true,
      name: true,
    },
    orderBy: { ticker: 'asc' },
  });

  if (companies.length === 0) return null;

  const companyIds = companies.map((c) => c.id);

  // Get latest prices
  const latestPrices = await db.stockPrice.findMany({
    where: { companyId: { in: companyIds } },
    orderBy: { date: 'desc' },
    distinct: ['companyId'],
  });

  // Get previous prices for change calculation
  const previousPrices = await db.stockPrice.findMany({
    where: { companyId: { in: companyIds } },
    orderBy: { date: 'desc' },
    skip: 1,
    distinct: ['companyId'],
  });

  // Get latest predictions
  const predictions = await db.prediction.findMany({
    where: { companyId: { in: companyIds } },
    orderBy: { targetDate: 'desc' },
    distinct: ['companyId', 'modelType'],
  });

  // Get recent news impacts
  const recentDate = new Date();
  recentDate.setDate(recentDate.getDate() - 7);

  const recentImpacts = await db.newsImpact.findMany({
    where: {
      companyId: { in: companyIds },
      createdAt: { gte: recentDate },
    },
    include: {
      company: { select: { ticker: true } },
      article: { select: { title: true, publishedAt: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  // Build company data
  const priceMap = new Map(latestPrices.map((p) => [p.companyId, p.close]));
  const prevPriceMap = new Map(previousPrices.map((p) => [p.companyId, p.close]));

  const fundamentalsPredMap = new Map(
    predictions
      .filter((p) => p.modelType === 'fundamentals')
      .map((p) => [p.companyId, p])
  );
  const hypePredMap = new Map(
    predictions.filter((p) => p.modelType === 'hype').map((p) => [p.companyId, p])
  );

  // Get recent sentiment per company
  const sentimentMap = new Map<string, string>();
  for (const impact of recentImpacts) {
    if (!sentimentMap.has(impact.companyId)) {
      sentimentMap.set(impact.companyId, impact.sentiment);
    }
  }

  const companiesData = companies.map((c) => {
    const latestPrice = priceMap.get(c.id);
    const prevPrice = prevPriceMap.get(c.id);
    const fundamentals = fundamentalsPredMap.get(c.id);
    const hype = hypePredMap.get(c.id);

    return {
      ticker: c.ticker,
      name: c.name,
      latestPrice: latestPrice ?? null,
      priceChange:
        latestPrice && prevPrice ? ((latestPrice - prevPrice) / prevPrice) * 100 : null,
      fundamentalsPrediction: fundamentals
        ? (fundamentals.predictedDirection as 'up' | 'down')
        : null,
      fundamentalsConfidence: fundamentals ? fundamentals.confidence : null,
      hypePrediction: hype ? (hype.predictedDirection as 'up' | 'down') : null,
      hypeConfidence: hype ? hype.confidence : null,
      recentSentiment: sentimentMap.get(c.id) ?? null,
    };
  });

  // Calculate sector accuracy
  const allPredictions = await db.prediction.findMany({
    where: { companyId: { in: companyIds }, wasCorrect: { not: null } },
    select: { modelType: true, wasCorrect: true },
  });

  const fundamentalsPreds = allPredictions.filter((p) => p.modelType === 'fundamentals');
  const hypePreds = allPredictions.filter((p) => p.modelType === 'hype');

  const accuracy = {
    fundamentals: {
      total: fundamentalsPreds.length,
      correct: fundamentalsPreds.filter((p) => p.wasCorrect).length,
      accuracy:
        fundamentalsPreds.length > 0
          ? (fundamentalsPreds.filter((p) => p.wasCorrect).length / fundamentalsPreds.length) *
            100
          : 0,
    },
    hype: {
      total: hypePreds.length,
      correct: hypePreds.filter((p) => p.wasCorrect).length,
      accuracy:
        hypePreds.length > 0
          ? (hypePreds.filter((p) => p.wasCorrect).length / hypePreds.length) * 100
          : 0,
    },
  };

  const recentNews = recentImpacts
    .filter((i) => i.article)
    .map((i) => ({
      title: i.article!.title,
      ticker: i.company.ticker,
      sentiment: i.sentiment,
      publishedAt: i.article!.publishedAt,
    }));

  return {
    sector,
    companies: companiesData,
    accuracy,
    recentNews,
  };
}

/**
 * Get list of all sectors
 */
export async function getAllSectors(): Promise<string[]> {
  const sectors = await db.company.findMany({
    where: { isActive: true, sector: { not: null } },
    select: { sector: true },
    distinct: ['sector'],
  });

  return sectors.map((s) => s.sector!).sort();
}

// Export as namespace
export const sectorData = {
  getSectorOverview,
  getSectorDetails,
  getAllSectors,
};
