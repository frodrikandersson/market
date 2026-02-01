/**
 * Performance Data Service
 * ========================
 * Fetches and aggregates model performance metrics.
 *
 * Usage:
 *   import { performanceData } from '@/services/performance-data';
 *   const data = await performanceData.getPerformanceData();
 */

import { db } from '@/lib/db';

// ===========================================
// Types
// ===========================================

export interface ModelAccuracy {
  total: number;
  correct: number;
  accuracy: number;
}

export interface AccuracyByDate {
  date: string;
  fundamentals: number;
  hype: number;
  total: number;
}

export interface AccuracyByConfidence {
  bucket: string;
  range: [number, number];
  fundamentals: ModelAccuracy;
  hype: ModelAccuracy;
}

export interface AccuracyBySector {
  sector: string;
  fundamentals: ModelAccuracy;
  hype: ModelAccuracy;
}

export interface RecentPrediction {
  id: string;
  ticker: string;
  companyName: string;
  modelType: 'fundamentals' | 'hype';
  predictedDirection: 'up' | 'down';
  actualDirection: 'up' | 'down' | 'flat' | null;
  confidence: number;
  wasCorrect: boolean | null;
  targetDate: Date;
  predictionDate: Date;
  actualChange: number | null;
  timeframe?: string;
  targetTime?: Date | null;
  baselinePrice: number | null;
  predictedChange: number | null;
  currentPrice: number | null;
  currentChange: number | null;
}

export interface ModelShowdown {
  fundamentalsWins: number;
  hypeWins: number;
  ties: number;
}

export interface PerformanceData {
  overall: {
    fundamentals: ModelAccuracy;
    hype: ModelAccuracy;
  };
  accuracyOverTime: AccuracyByDate[];
  accuracyByConfidence: AccuracyByConfidence[];
  accuracyBySector: AccuracyBySector[];
  recentPredictions: RecentPrediction[];
  streaks: {
    fundamentalsCurrentStreak: number;
    hypeCurrentStreak: number;
    fundamentalsBestStreak: number;
    hypeBestStreak: number;
  };
  modelShowdown: ModelShowdown;
}

// ===========================================
// Helper Functions
// ===========================================

function calculateAccuracy(predictions: { wasCorrect: boolean | null }[]): ModelAccuracy {
  const evaluated = predictions.filter((p) => p.wasCorrect !== null);
  const correct = evaluated.filter((p) => p.wasCorrect === true).length;
  return {
    total: evaluated.length,
    correct,
    accuracy: evaluated.length > 0 ? (correct / evaluated.length) * 100 : 0,
  };
}

function getConfidenceBucket(confidence: number): string {
  if (confidence >= 0.8) return '80-100%';
  if (confidence >= 0.6) return '60-80%';
  if (confidence >= 0.4) return '40-60%';
  return '0-40%';
}

function getConfidenceRange(bucket: string): [number, number] {
  switch (bucket) {
    case '80-100%':
      return [0.8, 1.0];
    case '60-80%':
      return [0.6, 0.8];
    case '40-60%':
      return [0.4, 0.6];
    default:
      return [0, 0.4];
  }
}

// ===========================================
// Main Functions
// ===========================================

/**
 * Get overall accuracy for both models
 */
export async function getOverallAccuracy(): Promise<{
  fundamentals: ModelAccuracy;
  hype: ModelAccuracy;
}> {
  const [fundamentalsPredictions, hypePredictions] = await Promise.all([
    db.prediction.findMany({
      where: { modelType: 'fundamentals' },
      select: { wasCorrect: true },
    }),
    db.prediction.findMany({
      where: { modelType: 'hype' },
      select: { wasCorrect: true },
    }),
  ]);

  return {
    fundamentals: calculateAccuracy(fundamentalsPredictions),
    hype: calculateAccuracy(hypePredictions),
  };
}

/**
 * Get accuracy over time (last 30 days)
 */
export async function getAccuracyOverTime(days: number = 30): Promise<AccuracyByDate[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const predictions = await db.prediction.findMany({
    where: {
      targetDate: { gte: startDate },
      wasCorrect: { not: null },
    },
    select: {
      modelType: true,
      targetDate: true,
      wasCorrect: true,
    },
    orderBy: { targetDate: 'asc' },
  });

  // Group by date
  const byDate = new Map<string, { fundamentals: boolean[]; hype: boolean[] }>();

  for (const pred of predictions) {
    const dateStr = pred.targetDate.toISOString().split('T')[0];
    if (!byDate.has(dateStr)) {
      byDate.set(dateStr, { fundamentals: [], hype: [] });
    }
    const entry = byDate.get(dateStr)!;
    if (pred.modelType === 'fundamentals') {
      entry.fundamentals.push(pred.wasCorrect!);
    } else {
      entry.hype.push(pred.wasCorrect!);
    }
  }

  // Calculate daily accuracy
  const result: AccuracyByDate[] = [];
  for (const [date, data] of byDate) {
    const fundamentalsAcc =
      data.fundamentals.length > 0
        ? (data.fundamentals.filter(Boolean).length / data.fundamentals.length) * 100
        : 0;
    const hypeAcc =
      data.hype.length > 0
        ? (data.hype.filter(Boolean).length / data.hype.length) * 100
        : 0;

    result.push({
      date,
      fundamentals: Math.round(fundamentalsAcc),
      hype: Math.round(hypeAcc),
      total: data.fundamentals.length + data.hype.length,
    });
  }

  return result;
}

/**
 * Get accuracy by confidence bucket
 */
export async function getAccuracyByConfidence(): Promise<AccuracyByConfidence[]> {
  const predictions = await db.prediction.findMany({
    where: { wasCorrect: { not: null } },
    select: {
      modelType: true,
      confidence: true,
      wasCorrect: true,
    },
  });

  const buckets = ['0-40%', '40-60%', '60-80%', '80-100%'];
  const result: AccuracyByConfidence[] = [];

  for (const bucket of buckets) {
    const range = getConfidenceRange(bucket);
    const fundamentalsPreds = predictions.filter(
      (p) =>
        p.modelType === 'fundamentals' && p.confidence >= range[0] && p.confidence < range[1]
    );
    const hypePreds = predictions.filter(
      (p) => p.modelType === 'hype' && p.confidence >= range[0] && p.confidence < range[1]
    );

    result.push({
      bucket,
      range,
      fundamentals: calculateAccuracy(fundamentalsPreds),
      hype: calculateAccuracy(hypePreds),
    });
  }

  return result;
}

/**
 * Get accuracy by sector
 */
export async function getAccuracyBySector(): Promise<AccuracyBySector[]> {
  const predictions = await db.prediction.findMany({
    where: { wasCorrect: { not: null } },
    select: {
      modelType: true,
      wasCorrect: true,
      company: {
        select: { sector: true },
      },
    },
  });

  // Group by sector
  const bySector = new Map<
    string,
    { fundamentals: { wasCorrect: boolean | null }[]; hype: { wasCorrect: boolean | null }[] }
  >();

  for (const pred of predictions) {
    const sector = pred.company.sector || 'Unknown';
    if (!bySector.has(sector)) {
      bySector.set(sector, { fundamentals: [], hype: [] });
    }
    const entry = bySector.get(sector)!;
    if (pred.modelType === 'fundamentals') {
      entry.fundamentals.push({ wasCorrect: pred.wasCorrect });
    } else {
      entry.hype.push({ wasCorrect: pred.wasCorrect });
    }
  }

  const result: AccuracyBySector[] = [];
  for (const [sector, data] of bySector) {
    result.push({
      sector,
      fundamentals: calculateAccuracy(data.fundamentals),
      hype: calculateAccuracy(data.hype),
    });
  }

  // Sort by total predictions
  result.sort(
    (a, b) => b.fundamentals.total + b.hype.total - (a.fundamentals.total + a.hype.total)
  );

  return result;
}

/**
 * Get recent predictions with results
 */
export async function getRecentPredictions(limit: number = 20): Promise<RecentPrediction[]> {
  const predictions = await db.prediction.findMany({
    orderBy: { targetDate: 'desc' },
    take: limit,
    include: {
      company: {
        select: { ticker: true, name: true },
      },
      snapshots: {
        orderBy: { checkedAt: 'desc' },
        take: 1, // Get only the latest snapshot
      },
    },
  });

  return predictions.map((p) => {
    const latestSnapshot = p.snapshots[0]; // Most recent snapshot
    const currentPrice = latestSnapshot?.currentPrice ?? null;

    // Calculate current change from baseline if we have both prices
    const currentChange = p.baselinePrice && currentPrice
      ? ((currentPrice - p.baselinePrice) / p.baselinePrice) * 100
      : null;

    return {
      id: p.id,
      ticker: p.company.ticker,
      companyName: p.company.name,
      modelType: p.modelType as 'fundamentals' | 'hype',
      predictedDirection: p.predictedDirection as 'up' | 'down',
      actualDirection: p.actualDirection as 'up' | 'down' | 'flat' | null,
      confidence: p.confidence,
      wasCorrect: p.wasCorrect,
      targetDate: p.targetDate,
      predictionDate: p.predictionDate,
      actualChange: p.actualChange,
      timeframe: p.timeframe,
      targetTime: p.targetTime,
      baselinePrice: p.baselinePrice,
      predictedChange: p.predictedChange,
      currentPrice,
      currentChange,
    };
  });
}

/**
 * Calculate prediction streaks
 */
export async function getStreaks(): Promise<{
  fundamentalsCurrentStreak: number;
  hypeCurrentStreak: number;
  fundamentalsBestStreak: number;
  hypeBestStreak: number;
}> {
  const [fundamentals, hype] = await Promise.all([
    db.prediction.findMany({
      where: { modelType: 'fundamentals', wasCorrect: { not: null } },
      orderBy: { targetDate: 'desc' },
      select: { wasCorrect: true },
    }),
    db.prediction.findMany({
      where: { modelType: 'hype', wasCorrect: { not: null } },
      orderBy: { targetDate: 'desc' },
      select: { wasCorrect: true },
    }),
  ]);

  function calculateStreaks(preds: { wasCorrect: boolean | null }[]): {
    current: number;
    best: number;
  } {
    let current = 0;
    let best = 0;
    let streak = 0;

    for (let i = 0; i < preds.length; i++) {
      if (preds[i].wasCorrect) {
        streak++;
        best = Math.max(best, streak);
        if (i === 0 || (i > 0 && preds[i - 1].wasCorrect)) {
          current = streak;
        }
      } else {
        streak = 0;
        if (i === 0) current = 0;
      }
    }

    return { current, best };
  }

  const fundamentalsStreaks = calculateStreaks(fundamentals);
  const hypeStreaks = calculateStreaks(hype);

  return {
    fundamentalsCurrentStreak: fundamentalsStreaks.current,
    hypeCurrentStreak: hypeStreaks.current,
    fundamentalsBestStreak: fundamentalsStreaks.best,
    hypeBestStreak: hypeStreaks.best,
  };
}

/**
 * Get full performance data
 */
export async function getPerformanceData(): Promise<PerformanceData> {
  const [overall, accuracyOverTime, accuracyByConfidence, accuracyBySector, recentPredictions, streaks, modelShowdown] =
    await Promise.all([
      getOverallAccuracy(),
      getAccuracyOverTime(30),
      getAccuracyByConfidence(),
      getAccuracyBySector(),
      getRecentPredictions(500),
      getStreaks(),
      getModelShowdown(),
    ]);

  return {
    overall,
    accuracyOverTime,
    accuracyByConfidence,
    accuracyBySector,
    recentPredictions,
    streaks,
    modelShowdown,
  };
}

/**
 * Get head-to-head model comparison
 * When both models predicted the same stock on the same day, which was right?
 */
export async function getModelShowdown(): Promise<{
  fundamentalsWins: number;
  hypeWins: number;
  ties: number;
}> {
  // Get all predictions with results
  const predictions = await db.prediction.findMany({
    where: { wasCorrect: { not: null } },
    select: {
      companyId: true,
      targetDate: true,
      modelType: true,
      wasCorrect: true,
    },
    orderBy: [{ companyId: 'asc' }, { targetDate: 'asc' }],
  });

  // Group by company and date
  const grouped = new Map<string, { fundamentals?: boolean; hype?: boolean }>();

  for (const pred of predictions) {
    const key = `${pred.companyId}_${pred.targetDate.toISOString().split('T')[0]}`;
    const current = grouped.get(key) || {};

    if (pred.modelType === 'fundamentals') {
      current.fundamentals = pred.wasCorrect ?? undefined;
    } else if (pred.modelType === 'hype') {
      current.hype = pred.wasCorrect ?? undefined;
    }

    grouped.set(key, current);
  }

  // Count wins
  let fundamentalsWins = 0;
  let hypeWins = 0;
  let ties = 0;

  for (const [, result] of grouped) {
    // Only count when both models made predictions
    if (result.fundamentals !== undefined && result.hype !== undefined) {
      if (result.fundamentals && !result.hype) {
        fundamentalsWins++;
      } else if (!result.fundamentals && result.hype) {
        hypeWins++;
      } else {
        // Both right or both wrong
        ties++;
      }
    }
  }

  return { fundamentalsWins, hypeWins, ties };
}

// Export as namespace
export const performanceData = {
  getOverallAccuracy,
  getAccuracyOverTime,
  getAccuracyByConfidence,
  getAccuracyBySector,
  getRecentPredictions,
  getStreaks,
  getModelShowdown,
  getPerformanceData,
};
