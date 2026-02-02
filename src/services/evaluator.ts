/**
 * Prediction Evaluator Service
 * ============================
 * Evaluates predictions against actual market results.
 *
 * Usage:
 *   import { evaluator } from '@/services/evaluator';
 *   await evaluator.evaluatePredictions();
 */

import { db } from '@/lib/db';
import { stockPriceService } from './stock-price';
import type { ModelType } from '@/types';

// ===========================================
// Types
// ===========================================

interface EvaluationResult {
  evaluated: number;
  correct: number;
  incorrect: number;
  errors: string[];
}

interface AccuracyStats {
  modelType: ModelType;
  totalEvaluated: number;
  correct: number;
  accuracy: number;
  byConfidenceBucket: {
    bucket: string;
    total: number;
    correct: number;
    accuracy: number;
  }[];
}

// ===========================================
// Main Functions
// ===========================================

/**
 * Evaluate a single prediction against actual results
 */
async function evaluatePrediction(predictionId: string): Promise<boolean | null> {
  const prediction = await db.prediction.findUnique({
    where: { id: predictionId },
    include: { company: true },
  });

  if (!prediction || prediction.wasCorrect !== null) {
    return null; // Already evaluated or doesn't exist
  }

  // Get price change for the target date
  const targetDate = new Date(prediction.targetDate);
  const dayBefore = new Date(targetDate);
  dayBefore.setDate(dayBefore.getDate() - 1);

  const priceChange = await stockPriceService.getPriceChange(
    prediction.companyId,
    dayBefore,
    targetDate
  );

  if (!priceChange) {
    console.log(`[Evaluator] No price data for ${prediction.company.ticker} on ${targetDate.toISOString().split('T')[0]}`);
    return null;
  }

  // Determine actual direction (any positive movement is UP, any negative is DOWN)
  const actualDirection =
    priceChange.changePercent > 0
      ? 'up'
      : priceChange.changePercent < 0
        ? 'down'
        : 'flat'; // Exactly 0% - extremely rare, treat as wrong prediction

  // Check if prediction was correct
  const wasCorrect =
    actualDirection === 'flat'
      ? false // If exactly 0% change, prediction was wrong (extremely rare case)
      : prediction.predictedDirection === actualDirection;

  // Update prediction
  await db.prediction.update({
    where: { id: predictionId },
    data: {
      actualDirection,
      actualChange: priceChange.changePercent,
      wasCorrect,
      evaluatedAt: new Date(),
    },
  });

  console.log(
    `[Evaluator] ${prediction.company.ticker} ${prediction.modelType}: ` +
      `Predicted ${prediction.predictedDirection.toUpperCase()}, ` +
      `Actual ${actualDirection.toUpperCase()} (${priceChange.changePercent >= 0 ? '+' : ''}${priceChange.changePercent.toFixed(2)}%) ` +
      `- ${wasCorrect ? 'CORRECT ✓' : 'WRONG ✗'}`
  );

  return wasCorrect;
}

/**
 * Evaluate all pending predictions that have passed their target date
 */
export async function evaluatePendingPredictions(): Promise<EvaluationResult> {
  const result: EvaluationResult = {
    evaluated: 0,
    correct: 0,
    incorrect: 0,
    errors: [],
  };

  // Use UTC dates for consistency across timezones
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Find predictions where target date has passed and not yet evaluated
  const pendingPredictions = await db.prediction.findMany({
    where: {
      targetDate: { lt: today },
      wasCorrect: null,
    },
    include: {
      company: { select: { ticker: true } },
    },
  });

  console.log(`[Evaluator] Found ${pendingPredictions.length} predictions to evaluate`);

  for (const prediction of pendingPredictions) {
    try {
      const wasCorrect = await evaluatePrediction(prediction.id);

      if (wasCorrect !== null) {
        result.evaluated++;
        if (wasCorrect) {
          result.correct++;
        } else {
          result.incorrect++;
        }
      }
    } catch (error) {
      const msg = `${prediction.company.ticker}: ${error}`;
      result.errors.push(msg);
      console.error(`[Evaluator] Error:`, msg);
    }
  }

  console.log(
    `[Evaluator] Evaluated ${result.evaluated}: ${result.correct} correct, ${result.incorrect} incorrect`
  );

  return result;
}

/**
 * Get accuracy statistics for a model type
 */
export async function getModelAccuracy(modelType: ModelType): Promise<AccuracyStats> {
  const predictions = await db.prediction.findMany({
    where: {
      modelType,
      wasCorrect: { not: null },
    },
    select: {
      confidence: true,
      wasCorrect: true,
    },
  });

  const totalEvaluated = predictions.length;
  const correct = predictions.filter((p) => p.wasCorrect === true).length;
  const accuracy = totalEvaluated > 0 ? correct / totalEvaluated : 0;

  // Group by confidence buckets
  const buckets = ['0-30%', '30-50%', '50-70%', '70-90%', '90-100%'];
  const bucketRanges = [
    [0, 0.3],
    [0.3, 0.5],
    [0.5, 0.7],
    [0.7, 0.9],
    [0.9, 1.01],
  ];

  const byConfidenceBucket = buckets.map((bucket, i) => {
    const [min, max] = bucketRanges[i];
    const inBucket = predictions.filter((p) => p.confidence >= min && p.confidence < max);
    const bucketCorrect = inBucket.filter((p) => p.wasCorrect === true).length;

    return {
      bucket,
      total: inBucket.length,
      correct: bucketCorrect,
      accuracy: inBucket.length > 0 ? bucketCorrect / inBucket.length : 0,
    };
  });

  return {
    modelType,
    totalEvaluated,
    correct,
    accuracy,
    byConfidenceBucket,
  };
}

/**
 * Get comparison of both models
 */
export async function getModelComparison() {
  const [fundamentals, hype] = await Promise.all([
    getModelAccuracy('fundamentals'),
    getModelAccuracy('hype'),
  ]);

  return {
    fundamentals,
    hype,
    winner:
      fundamentals.accuracy > hype.accuracy
        ? 'fundamentals'
        : hype.accuracy > fundamentals.accuracy
          ? 'hype'
          : 'tie',
    difference: Math.abs(fundamentals.accuracy - hype.accuracy) * 100,
  };
}

/**
 * Get recent prediction results
 */
export async function getRecentResults(limit: number = 20) {
  const predictions = await db.prediction.findMany({
    where: { wasCorrect: { not: null } },
    orderBy: { evaluatedAt: 'desc' },
    take: limit,
    include: {
      company: {
        select: { ticker: true, name: true },
      },
    },
  });

  return predictions.map((p) => ({
    ticker: p.company.ticker,
    name: p.company.name,
    modelType: p.modelType,
    predictedDirection: p.predictedDirection,
    actualDirection: p.actualDirection,
    actualChange: p.actualChange,
    confidence: p.confidence,
    wasCorrect: p.wasCorrect,
    evaluatedAt: p.evaluatedAt,
  }));
}

// Export as namespace
export const evaluator = {
  evaluatePrediction,
  evaluatePendingPredictions,
  getModelAccuracy,
  getModelComparison,
  getRecentResults,
};
