/**
 * Auto-Trader Service
 * ====================
 * Automatically executes paper trades based on AI predictions.
 * Maintains separate portfolios for each prediction model to compare performance.
 *
 * Portfolios:
 * - Fundamentals: Trades based on news sentiment analysis
 * - Hype: Trades based on social media sentiment
 * - Combined: Trades only when both models agree
 *
 * Usage:
 *   import { autoTrader } from '@/services/auto-trader';
 *   await autoTrader.executeFromPredictions();
 */

import { prisma } from '@/lib/db';
import { finnhub } from '@/lib/finnhub';

// Model types
export type ModelType = 'fundamentals' | 'hype' | 'combined';

// Portfolio configurations for each model
const PORTFOLIO_CONFIG: Record<ModelType, { name: string; description: string }> = {
  fundamentals: {
    name: 'AI Fundamentals Trader',
    description: 'Trades based on news sentiment analysis',
  },
  hype: {
    name: 'AI Hype Trader',
    description: 'Trades based on social media sentiment',
  },
  combined: {
    name: 'AI Combined Trader',
    description: 'Trades only when both models agree',
  },
};

// Configuration
const CONFIG = {
  MIN_CONFIDENCE: 0.65,
  HIGH_CONFIDENCE: 0.80,
  POSITION_SIZE_NORMAL: 0.05,
  POSITION_SIZE_HIGH: 0.08,
  MAX_POSITIONS: 10,
  MAX_SINGLE_POSITION: 0.15,
  PROFIT_TARGET: 0.05,
  STOP_LOSS: -0.03,
  MAX_HOLD_DAYS: 5,
  REVERSAL_CONFIDENCE: 0.60,
  STARTING_CASH: 100000,
};

interface TradeDecision {
  ticker: string;
  companyId: string;
  action: 'buy' | 'sell' | 'hold';
  reason: string;
  confidence: number;
  modelType: ModelType;
  suggestedShares?: number;
}

interface PortfolioResult {
  modelType: ModelType;
  tradesExecuted: number;
  buyOrders: number;
  sellOrders: number;
  decisions: TradeDecision[];
  errors: string[];
}

interface AutoTradeResult {
  portfolios: PortfolioResult[];
  totalTradesExecuted: number;
  errors: string[];
}

/**
 * Get or create a portfolio for a specific model type
 */
async function getOrCreatePortfolio(modelType: ModelType) {
  const config = PORTFOLIO_CONFIG[modelType];

  let portfolio = await prisma.paperPortfolio.findFirst({
    where: { name: config.name },
    include: {
      positions: true,
      trades: {
        orderBy: { executedAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!portfolio) {
    portfolio = await prisma.paperPortfolio.create({
      data: {
        name: config.name,
        startingCash: CONFIG.STARTING_CASH,
        currentCash: CONFIG.STARTING_CASH,
      },
      include: {
        positions: true,
        trades: {
          orderBy: { executedAt: 'desc' },
          take: 50,
        },
      },
    });
    console.log(`[AUTO-TRADER] Created new portfolio: ${config.name}`);
  }

  return portfolio;
}

type PortfolioWithRelations = Awaited<ReturnType<typeof getOrCreatePortfolio>>;

/**
 * Calculate total portfolio value
 */
async function calculatePortfolioValue(portfolio: PortfolioWithRelations): Promise<number> {
  let positionsValue = 0;

  for (const position of portfolio.positions) {
    try {
      const quote = await finnhub.getQuote(position.ticker);
      if (quote.c > 0) {
        positionsValue += position.shares * quote.c;
      }
    } catch {
      positionsValue += position.shares * position.avgCost;
    }
  }

  return portfolio.currentCash + positionsValue;
}

/**
 * Analyze predictions for a specific model type
 */
async function analyzePredictionsForModel(modelType: ModelType): Promise<TradeDecision[]> {
  const decisions: TradeDecision[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (modelType === 'combined') {
    // For combined, find stocks where both models agree
    const predictions = await prisma.prediction.findMany({
      where: {
        predictionDate: { gte: today },
        confidence: { gte: CONFIG.MIN_CONFIDENCE },
      },
      include: { company: true },
    });

    // Group by company
    const byCompany = new Map<string, typeof predictions>();
    for (const pred of predictions) {
      const existing = byCompany.get(pred.companyId) || [];
      existing.push(pred);
      byCompany.set(pred.companyId, existing);
    }

    // Find agreements
    for (const [companyId, preds] of byCompany) {
      const fundamentals = preds.find(p => p.modelType === 'fundamentals');
      const hype = preds.find(p => p.modelType === 'hype');

      if (fundamentals && hype &&
          fundamentals.predictedDirection === 'up' &&
          hype.predictedDirection === 'up' &&
          fundamentals.confidence >= CONFIG.MIN_CONFIDENCE &&
          hype.confidence >= CONFIG.MIN_CONFIDENCE) {

        const avgConfidence = (fundamentals.confidence + hype.confidence) / 2;
        decisions.push({
          ticker: fundamentals.company.ticker,
          companyId,
          action: 'buy',
          reason: `Both models agree UP (F: ${(fundamentals.confidence * 100).toFixed(0)}%, H: ${(hype.confidence * 100).toFixed(0)}%)`,
          confidence: avgConfidence,
          modelType: 'combined',
        });
      }
    }
  } else {
    // For single model, use only that model's predictions
    const predictions = await prisma.prediction.findMany({
      where: {
        predictionDate: { gte: today },
        modelType: modelType,
        confidence: { gte: CONFIG.MIN_CONFIDENCE },
        predictedDirection: 'up',
      },
      include: { company: true },
      orderBy: { confidence: 'desc' },
    });

    for (const pred of predictions) {
      decisions.push({
        ticker: pred.company.ticker,
        companyId: pred.companyId,
        action: 'buy',
        reason: `${modelType} predicts UP (${(pred.confidence * 100).toFixed(0)}% confidence)`,
        confidence: pred.confidence,
        modelType: modelType,
      });
    }
  }

  return decisions;
}

/**
 * Check existing positions for sell signals
 */
async function checkSellSignals(
  portfolio: PortfolioWithRelations,
  modelType: ModelType
): Promise<TradeDecision[]> {
  const decisions: TradeDecision[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const position of portfolio.positions) {
    try {
      const quote = await finnhub.getQuote(position.ticker);
      if (!quote.c || quote.c <= 0) continue;

      const currentPrice = quote.c;
      const gainLossPercent = (currentPrice - position.avgCost) / position.avgCost;

      // Check profit target
      if (gainLossPercent >= CONFIG.PROFIT_TARGET) {
        decisions.push({
          ticker: position.ticker,
          companyId: position.companyId,
          action: 'sell',
          reason: `Profit target hit: ${(gainLossPercent * 100).toFixed(1)}% gain`,
          confidence: 1,
          modelType,
          suggestedShares: position.shares,
        });
        continue;
      }

      // Check stop loss
      if (gainLossPercent <= CONFIG.STOP_LOSS) {
        decisions.push({
          ticker: position.ticker,
          companyId: position.companyId,
          action: 'sell',
          reason: `Stop-loss triggered: ${(gainLossPercent * 100).toFixed(1)}% loss`,
          confidence: 1,
          modelType,
          suggestedShares: position.shares,
        });
        continue;
      }

      // Check hold duration
      const holdDays = Math.floor(
        (Date.now() - position.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (holdDays >= CONFIG.MAX_HOLD_DAYS) {
        decisions.push({
          ticker: position.ticker,
          companyId: position.companyId,
          action: 'sell',
          reason: `Max hold period (${CONFIG.MAX_HOLD_DAYS} days) exceeded`,
          confidence: 0.8,
          modelType,
          suggestedShares: position.shares,
        });
        continue;
      }

      // Check for prediction reversal
      const whereClause = modelType === 'combined'
        ? { companyId: position.companyId, predictionDate: { gte: today } }
        : { companyId: position.companyId, predictionDate: { gte: today }, modelType };

      const latestPrediction = await prisma.prediction.findFirst({
        where: whereClause,
        orderBy: { confidence: 'desc' },
      });

      if (
        latestPrediction &&
        latestPrediction.predictedDirection === 'down' &&
        latestPrediction.confidence >= CONFIG.REVERSAL_CONFIDENCE
      ) {
        decisions.push({
          ticker: position.ticker,
          companyId: position.companyId,
          action: 'sell',
          reason: `Prediction reversed to DOWN (${(latestPrediction.confidence * 100).toFixed(0)}%)`,
          confidence: latestPrediction.confidence,
          modelType,
          suggestedShares: position.shares,
        });
      }
    } catch (error) {
      console.error(`[AUTO-TRADER] Error checking position ${position.ticker}:`, error);
    }
  }

  return decisions;
}

/**
 * Execute a buy order
 */
async function executeBuy(
  portfolio: PortfolioWithRelations,
  decision: TradeDecision,
  portfolioValue: number
): Promise<boolean> {
  try {
    const quote = await finnhub.getQuote(decision.ticker);
    if (!quote.c || quote.c <= 0) {
      console.error(`[AUTO-TRADER] Invalid price for ${decision.ticker}`);
      return false;
    }

    const price = quote.c;
    const isHighConfidence = decision.confidence >= CONFIG.HIGH_CONFIDENCE;
    const positionPercent = isHighConfidence ? CONFIG.POSITION_SIZE_HIGH : CONFIG.POSITION_SIZE_NORMAL;

    let tradeValue = portfolioValue * positionPercent;

    // Check existing position
    const existingPosition = portfolio.positions.find(p => p.companyId === decision.companyId);
    if (existingPosition) {
      const existingValue = existingPosition.shares * existingPosition.avgCost;
      const maxAllowed = portfolioValue * CONFIG.MAX_SINGLE_POSITION;
      if (existingValue >= maxAllowed) {
        return false;
      }
      tradeValue = Math.min(tradeValue, maxAllowed - existingValue);
    }

    if (tradeValue > portfolio.currentCash) {
      tradeValue = portfolio.currentCash * 0.95;
    }

    if (tradeValue < 100) {
      return false;
    }

    const shares = Math.floor((tradeValue / price) * 100) / 100;
    const totalCost = shares * price;

    await prisma.$transaction(async (tx) => {
      await tx.paperPortfolio.update({
        where: { id: portfolio.id },
        data: { currentCash: { decrement: totalCost } },
      });

      if (existingPosition) {
        const newTotalShares = existingPosition.shares + shares;
        const newTotalCost = (existingPosition.shares * existingPosition.avgCost) + totalCost;
        const newAvgCost = newTotalCost / newTotalShares;

        await tx.paperPosition.update({
          where: { id: existingPosition.id },
          data: { shares: newTotalShares, avgCost: newAvgCost },
        });
      } else {
        await tx.paperPosition.create({
          data: {
            portfolioId: portfolio.id,
            companyId: decision.companyId,
            ticker: decision.ticker,
            shares,
            avgCost: price,
          },
        });
      }

      await tx.paperTrade.create({
        data: {
          portfolioId: portfolio.id,
          companyId: decision.companyId,
          ticker: decision.ticker,
          type: 'buy',
          shares,
          price,
          totalValue: totalCost,
          modelType: decision.modelType,
          note: decision.reason,
        },
      });
    });

    console.log(`[AUTO-TRADER][${decision.modelType}] BUY ${shares} ${decision.ticker} @ $${price.toFixed(2)}`);
    return true;
  } catch (error) {
    console.error(`[AUTO-TRADER] Failed to buy ${decision.ticker}:`, error);
    return false;
  }
}

/**
 * Execute a sell order
 */
async function executeSell(
  portfolio: PortfolioWithRelations,
  decision: TradeDecision
): Promise<boolean> {
  try {
    const position = portfolio.positions.find(p => p.companyId === decision.companyId);
    if (!position) return false;

    const quote = await finnhub.getQuote(decision.ticker);
    if (!quote.c || quote.c <= 0) return false;

    const price = quote.c;
    const sharesToSell = decision.suggestedShares || position.shares;
    const totalValue = sharesToSell * price;

    await prisma.$transaction(async (tx) => {
      await tx.paperPortfolio.update({
        where: { id: portfolio.id },
        data: { currentCash: { increment: totalValue } },
      });

      if (sharesToSell >= position.shares) {
        await tx.paperPosition.delete({ where: { id: position.id } });
      } else {
        await tx.paperPosition.update({
          where: { id: position.id },
          data: { shares: { decrement: sharesToSell } },
        });
      }

      await tx.paperTrade.create({
        data: {
          portfolioId: portfolio.id,
          companyId: decision.companyId,
          ticker: decision.ticker,
          type: 'sell',
          shares: sharesToSell,
          price,
          totalValue,
          modelType: decision.modelType,
          note: decision.reason,
        },
      });
    });

    const gainLoss = ((price - position.avgCost) / position.avgCost * 100).toFixed(1);
    console.log(`[AUTO-TRADER][${decision.modelType}] SELL ${sharesToSell} ${decision.ticker} @ $${price.toFixed(2)} (${gainLoss}%)`);
    return true;
  } catch (error) {
    console.error(`[AUTO-TRADER] Failed to sell ${decision.ticker}:`, error);
    return false;
  }
}

/**
 * Execute trades for a single portfolio/model
 */
async function executeForModel(modelType: ModelType): Promise<PortfolioResult> {
  const result: PortfolioResult = {
    modelType,
    tradesExecuted: 0,
    buyOrders: 0,
    sellOrders: 0,
    decisions: [],
    errors: [],
  };

  try {
    const portfolio = await getOrCreatePortfolio(modelType);
    const portfolioValue = await calculatePortfolioValue(portfolio);

    console.log(`[AUTO-TRADER][${modelType}] Portfolio: $${portfolioValue.toFixed(2)}, Cash: $${portfolio.currentCash.toFixed(2)}`);

    // Check sell signals first
    const sellDecisions = await checkSellSignals(portfolio, modelType);
    result.decisions.push(...sellDecisions);

    for (const decision of sellDecisions) {
      if (await executeSell(portfolio, decision)) {
        result.tradesExecuted++;
        result.sellOrders++;
      }
    }

    // Refresh portfolio after sells
    const updatedPortfolio = await getOrCreatePortfolio(modelType);
    const updatedValue = await calculatePortfolioValue(updatedPortfolio);

    // Check position limit
    if (updatedPortfolio.positions.length < CONFIG.MAX_POSITIONS) {
      const buyDecisions = await analyzePredictionsForModel(modelType);

      // Filter out existing positions at max
      const filteredBuys = buyDecisions.filter(d => {
        const existing = updatedPortfolio.positions.find(p => p.companyId === d.companyId);
        if (!existing) return true;
        const existingValue = existing.shares * existing.avgCost;
        return existingValue < updatedValue * CONFIG.MAX_SINGLE_POSITION;
      });

      result.decisions.push(...filteredBuys);

      const slotsAvailable = CONFIG.MAX_POSITIONS - updatedPortfolio.positions.length;
      const buysToExecute = filteredBuys.slice(0, slotsAvailable);

      for (const decision of buysToExecute) {
        if (await executeBuy(updatedPortfolio, decision, updatedValue)) {
          result.tradesExecuted++;
          result.buyOrders++;
        }
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    result.errors.push(msg);
    console.error(`[AUTO-TRADER][${modelType}] Error:`, msg);
  }

  return result;
}

/**
 * Main function: Execute trades for all model portfolios
 */
async function executeFromPredictions(): Promise<AutoTradeResult> {
  console.log('\n========================================');
  console.log('[AUTO-TRADER] Starting multi-model trade cycle');
  console.log('========================================\n');

  const result: AutoTradeResult = {
    portfolios: [],
    totalTradesExecuted: 0,
    errors: [],
  };

  // Execute for each model type
  for (const modelType of ['fundamentals', 'hype', 'combined'] as ModelType[]) {
    console.log(`\n--- Processing ${modelType.toUpperCase()} portfolio ---`);
    const portfolioResult = await executeForModel(modelType);
    result.portfolios.push(portfolioResult);
    result.totalTradesExecuted += portfolioResult.tradesExecuted;
    result.errors.push(...portfolioResult.errors);
  }

  console.log('\n========================================');
  console.log(`[AUTO-TRADER] Complete: ${result.totalTradesExecuted} total trades`);
  console.log('========================================\n');

  return result;
}

/**
 * Get status for a specific model portfolio
 */
async function getPortfolioStatus(modelType: ModelType) {
  const portfolio = await getOrCreatePortfolio(modelType);
  const portfolioValue = await calculatePortfolioValue(portfolio);
  const config = PORTFOLIO_CONFIG[modelType];

  const positions = await Promise.all(
    portfolio.positions.map(async (pos) => {
      try {
        const quote = await finnhub.getQuote(pos.ticker);
        const currentPrice = quote.c || pos.avgCost;
        const marketValue = pos.shares * currentPrice;
        const gainLoss = marketValue - (pos.shares * pos.avgCost);
        const gainLossPercent = (currentPrice - pos.avgCost) / pos.avgCost * 100;

        return { ...pos, currentPrice, marketValue, gainLoss, gainLossPercent };
      } catch {
        return {
          ...pos,
          currentPrice: pos.avgCost,
          marketValue: pos.shares * pos.avgCost,
          gainLoss: 0,
          gainLossPercent: 0,
        };
      }
    })
  );

  return {
    modelType,
    name: config.name,
    description: config.description,
    portfolio: {
      id: portfolio.id,
      name: portfolio.name,
      startingCash: portfolio.startingCash,
      currentCash: portfolio.currentCash,
      totalValue: portfolioValue,
      totalGainLoss: portfolioValue - portfolio.startingCash,
      totalGainLossPercent: ((portfolioValue - portfolio.startingCash) / portfolio.startingCash) * 100,
    },
    positions,
    recentTrades: portfolio.trades,
  };
}

/**
 * Get status for all model portfolios
 */
async function getAllStatus() {
  const statuses = await Promise.all([
    getPortfolioStatus('fundamentals'),
    getPortfolioStatus('hype'),
    getPortfolioStatus('combined'),
  ]);

  return {
    portfolios: statuses,
    config: CONFIG,
  };
}

export const autoTrader = {
  executeFromPredictions,
  getPortfolioStatus,
  getAllStatus,
  CONFIG,
  PORTFOLIO_CONFIG,
};
