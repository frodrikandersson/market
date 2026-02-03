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
import { discord } from '@/lib/discord';
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
  baselinePrice: number | null;
  predictedChange: number | null;
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
const HIGH_CONFIDENCE_THRESHOLD = 0.7; // Send Discord alerts for predictions above this
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

  // Calculate confidence - IMPROVED FORMULA
  // Higher absolute score = higher confidence
  // Higher volatility = lower confidence (but reduced penalty)
  const baseConfidence = Math.abs(score);

  // Reduced volatility penalty from 0.3 to 0.15 max
  const volatilityPenalty = volatility ? Math.min(0.15, volatility * 3) : 0;

  // More generous formula: if you have strong signal, you get high confidence
  // Old: baseConfidence * 0.8 + 0.2 - volatilityPenalty
  // New: baseConfidence * 0.95 + 0.25 - volatilityPenalty
  const rawConfidence = baseConfidence * 0.95 + 0.25 - volatilityPenalty;

  const confidence = Math.max(
    MIN_CONFIDENCE,
    Math.min(MAX_CONFIDENCE, rawConfidence)
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

  // Calculate confidence - IMPROVED FORMULA
  // Hype model can now reach higher confidence when signal is strong
  // Old: Math.abs(score) * 0.7 + 0.25, capped at 0.85
  // New: Math.abs(score) * 0.85 + 0.3, can reach full MAX_CONFIDENCE
  const baseConfidence = Math.abs(score) * 0.85;
  const rawConfidence = baseConfidence + 0.3;

  const confidence = Math.max(
    MIN_CONFIDENCE,
    Math.min(MAX_CONFIDENCE, rawConfidence)
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
    // Get input factors + current stock price
    // Use 48-hour window to match the selection criteria in runDailyPredictions()
    const [newsImpact, socialImpact, volatility, momentum, currentPrice] = await Promise.all([
      getNewsImpact(companyId, 48),
      getSocialImpact(companyId, 48),
      stockPriceService.calculateVolatility(companyId, 7),
      stockPriceService.calculateMomentum(companyId, 5),
      stockPriceService.fetchQuote(ticker),
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

    // Skip prediction if no current price available
    if (!currentPrice?.price) {
      console.log(`[Predictor] Skipping ${ticker} - no current price available`);
      return null;
    }

    // Run the appropriate model
    const prediction = modelType === 'fundamentals' ? fundamentalsModel(input) : hypeModel(input);

    // Calculate predicted percentage change based on confidence and direction
    // Higher confidence = larger predicted move
    // Formula: ±(confidence × 3)% gives range of ~0.9% to ~2.85%
    const predictedChange = prediction.direction === 'up'
      ? prediction.confidence * 3
      : -prediction.confidence * 3;

    return {
      companyId,
      ticker,
      modelType,
      direction: prediction.direction,
      confidence: prediction.confidence,
      baselinePrice: currentPrice.price,
      predictedChange,
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
  // Use UTC dates for consistency across timezones
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Target date is next trading day (simplified: just tomorrow)
  const targetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

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
      baselinePrice: prediction.baselinePrice,
      predictedChange: prediction.predictedChange,
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
      baselinePrice: prediction.baselinePrice,
      predictedChange: prediction.predictedChange,
      newsImpactScore: prediction.newsImpactScore,
      socialImpactScore: prediction.socialImpactScore,
      priceVolatility: prediction.volatility,
      priceMomentum: prediction.momentum,
    },
  });
}

/**
 * Run predictions for all companies with recent data
 * - Fundamentals Model: predicts for companies with recent NEWS
 * - Hype Model: predicts for companies with recent SOCIAL MEDIA mentions
 */
export async function runDailyPredictions(): Promise<RunPredictionsResult> {
  const result: RunPredictionsResult = {
    fundamentalsPredictions: 0,
    hypePredictions: 0,
    errors: [],
  };

  // Collect high-confidence predictions for Discord alerts
  const highConfidencePredictions: Array<{
    ticker: string;
    companyName: string;
    modelType: 'fundamentals' | 'hype';
    direction: 'up' | 'down';
    confidence: number;
    newsImpactScore?: number;
    socialImpactScore?: number;
  }> = [];

  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 48); // Look at last 48 hours

  // Get companies with recent NEWS impacts (for Fundamentals model)
  const companiesWithNews = await db.newsImpact.findMany({
    where: { createdAt: { gte: cutoff } },
    select: { companyId: true },
    distinct: ['companyId'],
  });
  const newsCompanyIds = new Set(companiesWithNews.map((c) => c.companyId));

  // Get companies with recent SOCIAL mentions (for Hype model)
  const companiesWithSocial = await db.socialMention.findMany({
    where: { createdAt: { gte: cutoff } },
    select: { companyId: true },
    distinct: ['companyId'],
  });
  const socialCompanyIds = new Set(companiesWithSocial.map((c) => c.companyId));

  // Get all unique company IDs that need predictions
  const allCompanyIds = [...new Set([...newsCompanyIds, ...socialCompanyIds])];

  // Get company details (US stocks only - Finnhub free tier limitation)
  const companies = await db.company.findMany({
    where: {
      id: { in: allCompanyIds },
      isActive: true,
      ticker: {
        not: {
          contains: '.', // Exclude international stocks (.PA, .AX, .TO, etc.)
        },
      },
    },
    select: { id: true, ticker: true, name: true },
  });

  console.log(`[Predictor] Found ${newsCompanyIds.size} companies with news, ${socialCompanyIds.size} with social mentions`);
  console.log(`[Predictor] Running predictions for ${companies.length} total companies`);

  for (const company of companies) {
    // Generate Fundamentals prediction ONLY if company has news
    if (newsCompanyIds.has(company.id)) {
      try {
        const fundsPrediction = await generatePrediction(company.id, company.ticker, 'fundamentals');
        if (fundsPrediction) {
          await storePrediction(fundsPrediction);
          result.fundamentalsPredictions++;
          console.log(
            `[Predictor] ${company.ticker} Fundamentals: ${fundsPrediction.direction.toUpperCase()} (${(fundsPrediction.confidence * 100).toFixed(0)}%)`
          );

          // Track high-confidence predictions for Discord
          if (fundsPrediction.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
            highConfidencePredictions.push({
              ticker: company.ticker,
              companyName: company.name,
              modelType: 'fundamentals',
              direction: fundsPrediction.direction as 'up' | 'down',
              confidence: fundsPrediction.confidence,
              newsImpactScore: fundsPrediction.newsImpactScore ?? undefined,
            });
          }
        }
      } catch (error) {
        const msg = `${company.ticker} fundamentals: ${error}`;
        result.errors.push(msg);
      }
    }

    // Generate Hype prediction ONLY if company has social mentions
    if (socialCompanyIds.has(company.id)) {
      try {
        const hypePrediction = await generatePrediction(company.id, company.ticker, 'hype');
        if (hypePrediction) {
          await storePrediction(hypePrediction);
          result.hypePredictions++;
          console.log(
            `[Predictor] ${company.ticker} Hype: ${hypePrediction.direction.toUpperCase()} (${(hypePrediction.confidence * 100).toFixed(0)}%)`
          );

          // Track high-confidence predictions for Discord
          if (hypePrediction.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
            highConfidencePredictions.push({
              ticker: company.ticker,
              companyName: company.name,
              modelType: 'hype',
              direction: hypePrediction.direction as 'up' | 'down',
              confidence: hypePrediction.confidence,
              socialImpactScore: hypePrediction.socialImpactScore ?? undefined,
            });
          }
        }
      } catch (error) {
        const msg = `${company.ticker} hype: ${error}`;
        result.errors.push(msg);
      }
    }
  }

  console.log(
    `[Predictor] Generated ${result.fundamentalsPredictions} fundamentals, ${result.hypePredictions} hype predictions`
  );

  // Send Discord notifications for high-confidence predictions
  if (highConfidencePredictions.length > 0 && discord.isConfigured()) {
    console.log(`[Predictor] Sending ${highConfidencePredictions.length} high-confidence alerts to Discord`);
    try {
      await discord.sendPredictionBatch(highConfidencePredictions);
    } catch (error) {
      console.error('[Predictor] Failed to send Discord notifications:', error);
    }
  }

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
