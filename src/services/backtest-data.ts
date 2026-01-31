/**
 * Backtest Data Service
 * ======================
 * Calculates hypothetical returns if following model predictions.
 *
 * Usage:
 *   import { backtestData } from '@/services/backtest-data';
 *   const data = await backtestData.getBacktestResults();
 */

import { db } from '@/lib/db';

// ===========================================
// Types
// ===========================================

export interface BacktestSummary {
  period: {
    start: Date;
    end: Date;
    tradingDays: number;
  };
  fundamentals: ModelBacktest;
  hype: ModelBacktest;
  combined: ModelBacktest;
  benchmark: {
    return: number;
    trades: number;
  };
  monthlyReturns: MonthlyReturn[];
  byConfidence: ConfidenceBacktest[];
  bySector: SectorBacktest[];
}

export interface ModelBacktest {
  totalReturn: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

export interface MonthlyReturn {
  month: string;
  fundamentals: number;
  hype: number;
  combined: number;
}

export interface ConfidenceBacktest {
  bucket: string;
  fundamentals: { return: number; trades: number; winRate: number };
  hype: { return: number; trades: number; winRate: number };
}

export interface SectorBacktest {
  sector: string;
  fundamentals: { return: number; trades: number; winRate: number };
  hype: { return: number; trades: number; winRate: number };
}

// ===========================================
// Main Functions
// ===========================================

/**
 * Get backtest results
 */
export async function getBacktestResults(
  days: number = 90
): Promise<BacktestSummary> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  // Get all evaluated predictions in the period
  const predictions = await db.prediction.findMany({
    where: {
      targetDate: { gte: startDate, lte: endDate },
      wasCorrect: { not: null },
      actualChange: { not: null },
    },
    include: {
      company: {
        select: { sector: true },
      },
    },
    orderBy: { targetDate: 'asc' },
  });

  // Calculate model backtests
  const fundamentalsPreds = predictions.filter((p) => p.modelType === 'fundamentals');
  const hypePreds = predictions.filter((p) => p.modelType === 'hype');

  const fundamentals = calculateModelBacktest(fundamentalsPreds);
  const hype = calculateModelBacktest(hypePreds);

  // Combined: use fundamentals when both agree, otherwise skip
  const combinedPreds = predictions.filter((p) => {
    const sameDayPreds = predictions.filter(
      (other) =>
        other.companyId === p.companyId &&
        other.targetDate.getTime() === p.targetDate.getTime() &&
        other.id !== p.id
    );
    if (sameDayPreds.length === 0) return false;
    return sameDayPreds.some(
      (other) => other.predictedDirection === p.predictedDirection
    );
  });
  const combined = calculateModelBacktest(combinedPreds);

  // Calculate benchmark (buy and hold average)
  const benchmarkReturn = predictions.length > 0
    ? predictions.reduce((sum, p) => sum + (p.actualChange ?? 0), 0) / predictions.length
    : 0;

  // Monthly returns
  const monthlyReturns = calculateMonthlyReturns(predictions);

  // By confidence bucket
  const byConfidence = calculateConfidenceBacktest(predictions);

  // By sector
  const bySector = calculateSectorBacktest(predictions);

  // Count trading days
  const tradingDays = new Set(
    predictions.map((p) => p.targetDate.toISOString().split('T')[0])
  ).size;

  return {
    period: {
      start: startDate,
      end: endDate,
      tradingDays,
    },
    fundamentals,
    hype,
    combined,
    benchmark: {
      return: benchmarkReturn,
      trades: predictions.length,
    },
    monthlyReturns,
    byConfidence,
    bySector,
  };
}

/**
 * Calculate backtest metrics for a set of predictions
 */
function calculateModelBacktest(
  predictions: {
    predictedDirection: string;
    actualChange: number | null;
    wasCorrect: boolean | null;
    confidence: number;
  }[]
): ModelBacktest {
  if (predictions.length === 0) {
    return {
      totalReturn: 0,
      winRate: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      avgWin: 0,
      avgLoss: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
    };
  }

  // Calculate returns
  // If we predicted up and it went up, we gain. If we predicted down and it went down, we gain.
  const returns = predictions.map((p) => {
    const actualChange = p.actualChange ?? 0;
    return p.predictedDirection === 'up' ? actualChange : -actualChange;
  });

  const totalReturn = returns.reduce((sum, r) => sum + r, 0);
  const winningTrades = returns.filter((r) => r > 0).length;
  const losingTrades = returns.filter((r) => r < 0).length;

  const wins = returns.filter((r) => r > 0);
  const losses = returns.filter((r) => r < 0);

  const avgWin = wins.length > 0 ? wins.reduce((sum, r) => sum + r, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, r) => sum + r, 0) / losses.length) : 0;

  // Calculate max drawdown
  let peak = 0;
  let maxDrawdown = 0;
  let cumReturn = 0;

  for (const r of returns) {
    cumReturn += r;
    if (cumReturn > peak) peak = cumReturn;
    const drawdown = peak - cumReturn;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Calculate Sharpe ratio (simplified - daily returns, assume 0 risk-free rate)
  const avgReturn = returns.length > 0 ? totalReturn / returns.length : 0;
  const variance =
    returns.length > 1
      ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)
      : 0;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized

  return {
    totalReturn,
    winRate: predictions.length > 0 ? (winningTrades / predictions.length) * 100 : 0,
    totalTrades: predictions.length,
    winningTrades,
    losingTrades,
    avgWin,
    avgLoss,
    maxDrawdown,
    sharpeRatio,
  };
}

/**
 * Calculate monthly returns
 */
function calculateMonthlyReturns(
  predictions: {
    modelType: string;
    targetDate: Date;
    predictedDirection: string;
    actualChange: number | null;
  }[]
): MonthlyReturn[] {
  const byMonth = new Map<string, { fundamentals: number[]; hype: number[] }>();

  for (const p of predictions) {
    const month = p.targetDate.toISOString().slice(0, 7); // YYYY-MM
    if (!byMonth.has(month)) {
      byMonth.set(month, { fundamentals: [], hype: [] });
    }
    const entry = byMonth.get(month)!;
    const actualChange = p.actualChange ?? 0;
    const ret = p.predictedDirection === 'up' ? actualChange : -actualChange;

    if (p.modelType === 'fundamentals') {
      entry.fundamentals.push(ret);
    } else {
      entry.hype.push(ret);
    }
  }

  const result: MonthlyReturn[] = [];
  for (const [month, data] of byMonth) {
    const fundamentalsReturn =
      data.fundamentals.length > 0
        ? data.fundamentals.reduce((sum, r) => sum + r, 0)
        : 0;
    const hypeReturn =
      data.hype.length > 0 ? data.hype.reduce((sum, r) => sum + r, 0) : 0;

    result.push({
      month,
      fundamentals: fundamentalsReturn,
      hype: hypeReturn,
      combined: (fundamentalsReturn + hypeReturn) / 2,
    });
  }

  result.sort((a, b) => a.month.localeCompare(b.month));
  return result;
}

/**
 * Calculate backtest by confidence bucket
 */
function calculateConfidenceBacktest(
  predictions: {
    modelType: string;
    confidence: number;
    predictedDirection: string;
    actualChange: number | null;
    wasCorrect: boolean | null;
  }[]
): ConfidenceBacktest[] {
  const buckets = ['0-40%', '40-60%', '60-80%', '80-100%'];
  const ranges: Record<string, [number, number]> = {
    '0-40%': [0, 0.4],
    '40-60%': [0.4, 0.6],
    '60-80%': [0.6, 0.8],
    '80-100%': [0.8, 1.0],
  };

  return buckets.map((bucket) => {
    const range = ranges[bucket];
    const fundamentalsPreds = predictions.filter(
      (p) =>
        p.modelType === 'fundamentals' &&
        p.confidence >= range[0] &&
        p.confidence < range[1]
    );
    const hypePreds = predictions.filter(
      (p) =>
        p.modelType === 'hype' && p.confidence >= range[0] && p.confidence < range[1]
    );

    const calcBucketStats = (preds: typeof predictions) => {
      if (preds.length === 0) return { return: 0, trades: 0, winRate: 0 };
      const returns = preds.map((p) => {
        const actualChange = p.actualChange ?? 0;
        return p.predictedDirection === 'up' ? actualChange : -actualChange;
      });
      const wins = returns.filter((r) => r > 0).length;
      return {
        return: returns.reduce((sum, r) => sum + r, 0),
        trades: preds.length,
        winRate: (wins / preds.length) * 100,
      };
    };

    return {
      bucket,
      fundamentals: calcBucketStats(fundamentalsPreds),
      hype: calcBucketStats(hypePreds),
    };
  });
}

/**
 * Calculate backtest by sector
 */
function calculateSectorBacktest(
  predictions: {
    modelType: string;
    predictedDirection: string;
    actualChange: number | null;
    wasCorrect: boolean | null;
    company: { sector: string | null };
  }[]
): SectorBacktest[] {
  const bySector = new Map<
    string,
    { fundamentals: typeof predictions; hype: typeof predictions }
  >();

  for (const p of predictions) {
    const sector = p.company.sector ?? 'Unknown';
    if (!bySector.has(sector)) {
      bySector.set(sector, { fundamentals: [], hype: [] });
    }
    const entry = bySector.get(sector)!;
    if (p.modelType === 'fundamentals') {
      entry.fundamentals.push(p);
    } else {
      entry.hype.push(p);
    }
  }

  const calcSectorStats = (preds: typeof predictions) => {
    if (preds.length === 0) return { return: 0, trades: 0, winRate: 0 };
    const returns = preds.map((p) => {
      const actualChange = p.actualChange ?? 0;
      return p.predictedDirection === 'up' ? actualChange : -actualChange;
    });
    const wins = returns.filter((r) => r > 0).length;
    return {
      return: returns.reduce((sum, r) => sum + r, 0),
      trades: preds.length,
      winRate: (wins / preds.length) * 100,
    };
  };

  const result: SectorBacktest[] = [];
  for (const [sector, data] of bySector) {
    result.push({
      sector,
      fundamentals: calcSectorStats(data.fundamentals),
      hype: calcSectorStats(data.hype),
    });
  }

  // Sort by total trades
  result.sort(
    (a, b) =>
      b.fundamentals.trades + b.hype.trades - (a.fundamentals.trades + a.hype.trades)
  );

  return result;
}

// Export as namespace
export const backtestData = {
  getBacktestResults,
};
