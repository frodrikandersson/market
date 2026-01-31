/**
 * Prediction Engine
 * =================
 * Generates stock predictions based on news sentiment and social media.
 * Implements two competing models:
 * - Fundamentals Model: Based on traditional news sources
 * - Hype Model: Based on social media sentiment
 *
 * Usage:
 *   import { predictor } from '@/services/predictor';
 *   await predictor.runDailyPredictions();
 */

import { db } from '@/lib/db';
import { stockPriceService } from './stock-price';
import type { PredictionDirection, ModelType, Sentiment } from '@/types';

// ===========================================
// Types
// ===========================================

interface PredictionInput {
  companyId: string;
  ticker: string;
  newsImpactScore: number;
  socialImpactScore: number;
  volatility: number | null;
  momentum: number | null;
  recentSentiments: Sentiment[];
}

interface PredictionOutput {
  direction: PredictionDirection;
  confidence: number;
  factors: {
    newsImpact: number;
    socialImpact: number;
    volatility: number;
    momentum: number;
  };
}

interface PredictionResult {
  companyId: string;
  ticker: string;
  modelType: ModelType;
  direction: PredictionDirection;
  confidence: number;
  newsImpactScore: number | null;
  socialImpactScore: number | null;
  volatility: number | null;
  momentum: number | null;
}

interface RunPredictionsResult {
  fundamentalsPredictions: number;
  hypePredictions: number;
  errors: string[];
}

// ===========================================
// Configuration
// ===========================================

// Weights for the Fundamentals Model
const FUNDAMENTALS_WEIGHTS = {
  newsImpact: 0.6,      // News sentiment is primary factor
  momentum: 0.25,       // Recent price trend
  volatility: 0.15,     // Higher volatility = lower confidence
};

// Weights for the Hype Model
const HYPE_WEIGHTS = {
  socialImpact: 0.7,    // Social sentiment is primary factor
  newsImpact: 0.15,     // Some news influence
  momentum: 0.15,       // Price momentum
};

// Confidence thresholds
const MIN_CONFIDENCE = 0.3;
const MAX_CONFIDENCE = 0.95;

// ===========================================
// Prediction Algorithms
// ===========================================

/**
 * Fundamentals Model
 * Based primarily on news sentiment from traditional sources
 */
function fundamentalsModel(input: PredictionInput): PredictionOutput {
  const { newsImpactScore, momentum, volatility } = input;

  // Normalize inputs to -1 to 1 range
  const normalizedNews = Math.max(-1, Math.min(1, newsImpactScore));
  const normalizedMomentum = momentum ? Math.max(-1, Math.min(1, momentum * 10)) : 0;

  // Calculate weighted score
  const score =
    normalizedNews * FUNDAMENTALS_WEIGHTS.newsImpact +
    normalizedMomentum * FUNDAMENTALS_WEIGHTS.momentum;

  // Determine direction
  const direction: PredictionDirection = score >= 0 ? 'up' : 'down';

  // Calculate confidence
  // Higher absolute score = higher confidence
  // Higher volatility = lower confidence
  const baseConfidence = Math.abs(score);
  const volatilityPenalty = volatility ? Math.min(0.3, volatility * 5) : 0;
  const confidence = Math.max(
    MIN_CONFIDENCE,
    Math.min(MAX_CONFIDENCE, baseConfidence * 0.8 + 0.2 - volatilityPenalty)
  );

  return {
    direction,
    confidence,
    factors: {
      newsImpact: normalizedNews,
      socialImpact: 0,
      volatility: volatility || 0,
      momentum: normalizedMomentum,
    },
  };
}

/**
 * Hype Model
 * Based primarily on social media sentiment from influential accounts
 */
function hypeModel(input: PredictionInput): PredictionOutput {
  const { socialImpactScore, newsImpactScore, momentum } = input;

  // Normalize inputs
  const normalizedSocial = Math.max(-1, Math.min(1, socialImpactScore));
  const normalizedNews = Math.max(-1, Math.min(1, newsImpactScore * 0.5));
  const normalizedMomentum = momentum ? Math.max(-1, Math.min(1, momentum * 10)) : 0;

  // Calculate weighted score
  const score =
    normalizedSocial * HYPE_WEIGHTS.socialImpact +
    normalizedNews * HYPE_WEIGHTS.newsImpact +
    normalizedMomentum * HYPE_WEIGHTS.momentum;

  // Determine direction
  const direction: PredictionDirection = score >= 0 ? 'up' : 'down';

  // Calculate confidence
  // Hype model is generally less confident due to noise
  const baseConfidence = Math.abs(score) * 0.7;
  const confidence = Math.max(
    MIN_CONFIDENCE,
    Math.min(MAX_CONFIDENCE - 0.1, baseConfidence + 0.25)
  );

  return {
    direction,
    confidence,
    factors: {
      newsImpact: normalizedNews,
      socialImpact: normalizedSocial,
      volatility: 0,
      momentum: normalizedMomentum,
    },
  };
}

// ===========================================
// Main Functions
// ===========================================

/**
 * Get aggregated news impact for a company
 */
async function getNewsImpact(
  companyId: string,
  hoursBack: number = 24
): Promise<{ score: number; sentiments: Sentiment[] }> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hoursBack);

  const impacts = await db.newsImpact.findMany({
    where: {
      companyId,
      createdAt: { gte: cutoff },
    },
    select: {
      impactScore: true,
      sentiment: true,
      confidence: true,
    },
  });

  if (impacts.length === 0) {
    return { score: 0, sentiments: [] };
  }

  // Weight by confidence
  const totalWeight = impacts.reduce((sum, i) => sum + i.confidence, 0);
  const weightedScore = impacts.reduce((sum, i) => sum + i.impactScore * i.confidence, 0);

  return {
    score: totalWeight > 0 ? weightedScore / totalWeight : 0,
    sentiments: impacts.map((i) => i.sentiment as Sentiment),
  };
}

/**
 * Get aggregated social media impact for a company
 */
async function getSocialImpact(
  companyId: string,
  hoursBack: number = 24
): Promise<{ score: number; sentiments: Sentiment[] }> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hoursBack);

  const mentions = await db.socialMention.findMany({
    where: {
      companyId,
      createdAt: { gte: cutoff },
    },
    include: {
      post: {
        include: {
          account: { select: { weight: true } },
        },
      },
    },
  });

  if (mentions.length === 0) {
    return { score: 0, sentiments: [] };
  }

  // Calculate weighted score based on account influence
  let totalWeight = 0;
  let weightedScore = 0;

  for (const mention of mentions) {
    const accountWeight = mention.post.account.weight;
    const sentimentValue =
      mention.sentiment === 'positive' ? 1 : mention.sentiment === 'negative' ? -1 : 0;
    const score = sentimentValue * mention.confidence * accountWeight;

    weightedScore += score;
    totalWeight += accountWeight;
  }

  return {
    score: totalWeight > 0 ? weightedScore / totalWeight : 0,
    sentiments: mentions.map((m) => m.sentiment as Sentiment),
  };
}

/**
 * Generate prediction for a single company
 */
export async function generatePrediction(
  companyId: string,
  ticker: string,
  modelType: ModelType
): Promise<PredictionResult | null> {
  try {
    // Get input factors
    const [newsImpact, socialImpact, volatility, momentum] = await Promise.all([
      getNewsImpact(companyId, 24),
      getSocialImpact(companyId, 24),
      stockPriceService.calculateVolatility(companyId, 7),
      stockPriceService.calculateMomentum(companyId, 5),
    ]);

    const input: PredictionInput = {
      companyId,
      ticker,
      newsImpactScore: newsImpact.score,
      socialImpactScore: socialImpact.score,
      volatility,
      momentum,
      recentSentiments: [...newsImpact.sentiments, ...socialImpact.sentiments],
    };

    // Run the appropriate model
    const prediction = modelType === 'fundamentals' ? fundamentalsModel(input) : hypeModel(input);

    return {
      companyId,
      ticker,
      modelType,
      direction: prediction.direction,
      confidence: prediction.confidence,
      newsImpactScore: newsImpact.score,
      socialImpactScore: socialImpact.score,
      volatility,
      momentum,
    };
  } catch (error) {
    console.error(`[Predictor] Failed to generate prediction for ${ticker}:`, error);
    return null;
  }
}

/**
 * Store prediction in database
 */
async function storePrediction(prediction: PredictionResult): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Target date is next trading day (simplified: just tomorrow)
  const targetDate = new Date(today);
  targetDate.setDate(targetDate.getDate() + 1);

  await db.prediction.upsert({
    where: {
      companyId_targetDate_modelType: {
        companyId: prediction.companyId,
        targetDate,
        modelType: prediction.modelType,
      },
    },
    update: {
      predictedDirection: prediction.direction,
      confidence: prediction.confidence,
      newsImpactScore: prediction.newsImpactScore,
      socialImpactScore: prediction.socialImpactScore,
      priceVolatility: prediction.volatility,
      priceMomentum: prediction.momentum,
    },
    create: {
      companyId: prediction.companyId,
      predictionDate: today,
      targetDate,
      modelType: prediction.modelType,
      predictedDirection: prediction.direction,
      confidence: prediction.confidence,
      newsImpactScore: prediction.newsImpactScore,
      socialImpactScore: prediction.socialImpactScore,
      priceVolatility: prediction.volatility,
      priceMomentum: prediction.momentum,
    },
  });
}

/**
 * Run predictions for all companies with recent news
 */
export async function runDailyPredictions(): Promise<RunPredictionsResult> {
  const result: RunPredictionsResult = {
    fundamentalsPredictions: 0,
    hypePredictions: 0,
    errors: [],
  };

  // Get companies that have recent news impacts
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 48); // Look at last 48 hours

  const companiesWithNews = await db.newsImpact.findMany({
    where: { createdAt: { gte: cutoff } },
    select: { companyId: true },
    distinct: ['companyId'],
  });

  const companyIds = companiesWithNews.map((c) => c.companyId);

  // Get company details
  const companies = await db.company.findMany({
    where: {
      id: { in: companyIds },
      isActive: true,
    },
    select: { id: true, ticker: true },
  });

  console.log(`[Predictor] Running predictions for ${companies.length} companies`);

  for (const company of companies) {
    // Generate Fundamentals prediction
    try {
      const fundsPrediction = await generatePrediction(company.id, company.ticker, 'fundamentals');
      if (fundsPrediction) {
        await storePrediction(fundsPrediction);
        result.fundamentalsPredictions++;
        console.log(
          `[Predictor] ${company.ticker} Fundamentals: ${fundsPrediction.direction.toUpperCase()} (${(fundsPrediction.confidence * 100).toFixed(0)}%)`
        );
      }
    } catch (error) {
      const msg = `${company.ticker} fundamentals: ${error}`;
      result.errors.push(msg);
    }

    // Generate Hype prediction
    try {
      const hypePrediction = await generatePrediction(company.id, company.ticker, 'hype');
      if (hypePrediction) {
        await storePrediction(hypePrediction);
        result.hypePredictions++;
        console.log(
          `[Predictor] ${company.ticker} Hype: ${hypePrediction.direction.toUpperCase()} (${(hypePrediction.confidence * 100).toFixed(0)}%)`
        );
      }
    } catch (error) {
      const msg = `${company.ticker} hype: ${error}`;
      result.errors.push(msg);
    }
  }

  console.log(
    `[Predictor] Generated ${result.fundamentalsPredictions} fundamentals, ${result.hypePredictions} hype predictions`
  );

  return result;
}

/**
 * Get latest predictions for display
 */
export async function getLatestPredictions(limit: number = 20) {
  const predictions = await db.prediction.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      company: {
        select: { ticker: true, name: true, sector: true },
      },
    },
  });

  return predictions.map((p) => ({
    ticker: p.company.ticker,
    name: p.company.name,
    sector: p.company.sector,
    modelType: p.modelType as ModelType,
    direction: p.predictedDirection as PredictionDirection,
    confidence: p.confidence,
    targetDate: p.targetDate,
    wasCorrect: p.wasCorrect,
    actualChange: p.actualChange,
  }));
}

// Export as namespace
export const predictor = {
  generatePrediction,
  runDailyPredictions,
  getLatestPredictions,
};
