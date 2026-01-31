/**
 * Auto-Trader Service
 * ====================
 * Automatically executes paper trades based on AI predictions.
 *
 * Trading Strategy:
 * - BUY: When prediction confidence > threshold and direction is "up"
 * - SELL: When prediction reverses, hits profit target, or stop-loss
 *
 * Usage:
 *   import { autoTrader } from '@/services/auto-trader';
 *   await autoTrader.executeFromPredictions();
 */

import { prisma } from '@/lib/db';
import { finnhub } from '@/lib/finnhub';

// Configuration
const CONFIG = {
  // Minimum confidence to trigger a trade
  MIN_CONFIDENCE: 0.65,

  // High confidence threshold for larger positions
  HIGH_CONFIDENCE: 0.80,

  // Position sizing (percentage of available cash)
  POSITION_SIZE_NORMAL: 0.05,  // 5% of portfolio per trade
  POSITION_SIZE_HIGH: 0.08,    // 8% for high confidence

  // Maximum positions at once
  MAX_POSITIONS: 10,

  // Maximum position in single stock (% of portfolio)
  MAX_SINGLE_POSITION: 0.15,   // 15% max in one stock

  // Sell triggers
  PROFIT_TARGET: 0.05,         // Sell at 5% profit
  STOP_LOSS: -0.03,            // Sell at 3% loss
  MAX_HOLD_DAYS: 5,            // Maximum days to hold

  // Sell when prediction reverses with this confidence
  REVERSAL_CONFIDENCE: 0.60,
};

interface TradeDecision {
  ticker: string;
  companyId: string;
  action: 'buy' | 'sell' | 'hold';
  reason: string;
  confidence: number;
  modelType: 'fundamentals' | 'hype';
  suggestedShares?: number;
  suggestedValue?: number;
}

interface AutoTradeResult {
  decisions: TradeDecision[];
  tradesExecuted: number;
  buyOrders: number;
  sellOrders: number;
  errors: string[];
}

/**
 * Get or create the auto-trading portfolio
 */
async function getAutoPortfolio() {
  let portfolio = await prisma.paperPortfolio.findFirst({
    where: { name: 'AI Auto-Trader' },
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
        name: 'AI Auto-Trader',
        startingCash: 100000,
        currentCash: 100000,
      },
      include: {
        positions: true,
        trades: {
          orderBy: { executedAt: 'desc' },
          take: 50,
        },
      },
    });
    console.log('[AUTO-TRADER] Created new AI portfolio');
  }

  return portfolio;
}

/**
 * Calculate total portfolio value
 */
async function calculatePortfolioValue(
  portfolio: Awaited<ReturnType<typeof getAutoPortfolio>>
): Promise<number> {
  let positionsValue = 0;

  for (const position of portfolio.positions) {
    try {
      const quote = await finnhub.getQuote(position.ticker);
      if (quote.c > 0) {
        positionsValue += position.shares * quote.c;
      }
    } catch {
      // Use avg cost as fallback
      positionsValue += position.shares * position.avgCost;
    }
  }

  return portfolio.currentCash + positionsValue;
}

/**
 * Analyze predictions and generate trade decisions
 */
async function analyzePredictions(): Promise<TradeDecision[]> {
  const decisions: TradeDecision[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get today's predictions
  const predictions = await prisma.prediction.findMany({
    where: {
      predictionDate: { gte: today },
      confidence: { gte: CONFIG.MIN_CONFIDENCE },
    },
    include: {
      company: true,
    },
    orderBy: { confidence: 'desc' },
  });

  console.log(`[AUTO-TRADER] Found ${predictions.length} high-confidence predictions`);

  // Group by company to handle both model types
  const byCompany = new Map<string, typeof predictions>();
  for (const pred of predictions) {
    const existing = byCompany.get(pred.companyId) || [];
    existing.push(pred);
    byCompany.set(pred.companyId, existing);
  }

  // Analyze each company
  for (const [companyId, companyPreds] of byCompany) {
    const company = companyPreds[0].company;

    // Find the highest confidence prediction
    const bestPred = companyPreds.reduce((best, curr) =>
      curr.confidence > best.confidence ? curr : best
    );

    // Check if both models agree
    const fundamentals = companyPreds.find(p => p.modelType === 'fundamentals');
    const hype = companyPreds.find(p => p.modelType === 'hype');
    const modelsAgree = fundamentals && hype &&
      fundamentals.predictedDirection === hype.predictedDirection;

    // Boost confidence if models agree
    let effectiveConfidence = bestPred.confidence;
    if (modelsAgree) {
      effectiveConfidence = Math.min(0.95, effectiveConfidence + 0.1);
    }

    if (bestPred.predictedDirection === 'up' && effectiveConfidence >= CONFIG.MIN_CONFIDENCE) {
      decisions.push({
        ticker: company.ticker,
        companyId,
        action: 'buy',
        reason: modelsAgree
          ? `Both models predict UP (${(effectiveConfidence * 100).toFixed(0)}% confidence)`
          : `${bestPred.modelType} predicts UP (${(bestPred.confidence * 100).toFixed(0)}% confidence)`,
        confidence: effectiveConfidence,
        modelType: bestPred.modelType as 'fundamentals' | 'hype',
      });
    }
  }

  return decisions;
}

/**
 * Check existing positions for sell signals
 */
async function checkSellSignals(
  portfolio: Awaited<ReturnType<typeof getAutoPortfolio>>
): Promise<TradeDecision[]> {
  const decisions: TradeDecision[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const position of portfolio.positions) {
    try {
      // Get current price
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
          modelType: 'fundamentals',
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
          modelType: 'fundamentals',
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
          modelType: 'fundamentals',
          suggestedShares: position.shares,
        });
        continue;
      }

      // Check for prediction reversal
      const latestPrediction = await prisma.prediction.findFirst({
        where: {
          companyId: position.companyId,
          predictionDate: { gte: today },
        },
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
          reason: `Prediction reversed to DOWN (${(latestPrediction.confidence * 100).toFixed(0)}% confidence)`,
          confidence: latestPrediction.confidence,
          modelType: latestPrediction.modelType as 'fundamentals' | 'hype',
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
  portfolio: Awaited<ReturnType<typeof getAutoPortfolio>>,
  decision: TradeDecision,
  portfolioValue: number
): Promise<boolean> {
  try {
    // Get current price
    const quote = await finnhub.getQuote(decision.ticker);
    if (!quote.c || quote.c <= 0) {
      console.error(`[AUTO-TRADER] Invalid price for ${decision.ticker}`);
      return false;
    }

    const price = quote.c;

    // Calculate position size
    const isHighConfidence = decision.confidence >= CONFIG.HIGH_CONFIDENCE;
    const positionPercent = isHighConfidence
      ? CONFIG.POSITION_SIZE_HIGH
      : CONFIG.POSITION_SIZE_NORMAL;

    let tradeValue = portfolioValue * positionPercent;

    // Check existing position
    const existingPosition = portfolio.positions.find(
      p => p.companyId === decision.companyId
    );
    if (existingPosition) {
      const existingValue = existingPosition.shares * existingPosition.avgCost;
      const maxAllowed = portfolioValue * CONFIG.MAX_SINGLE_POSITION;
      if (existingValue >= maxAllowed) {
        console.log(`[AUTO-TRADER] Skip ${decision.ticker}: max position reached`);
        return false;
      }
      tradeValue = Math.min(tradeValue, maxAllowed - existingValue);
    }

    // Check cash available
    if (tradeValue > portfolio.currentCash) {
      tradeValue = portfolio.currentCash * 0.95; // Keep 5% buffer
    }

    if (tradeValue < 100) {
      console.log(`[AUTO-TRADER] Skip ${decision.ticker}: trade value too small`);
      return false;
    }

    const shares = Math.floor((tradeValue / price) * 100) / 100; // Round to 2 decimals
    const totalCost = shares * price;

    // Execute the trade
    await prisma.$transaction(async (tx) => {
      // Update cash
      await tx.paperPortfolio.update({
        where: { id: portfolio.id },
        data: { currentCash: { decrement: totalCost } },
      });

      // Update or create position
      if (existingPosition) {
        const newTotalShares = existingPosition.shares + shares;
        const newTotalCost = (existingPosition.shares * existingPosition.avgCost) + totalCost;
        const newAvgCost = newTotalCost / newTotalShares;

        await tx.paperPosition.update({
          where: { id: existingPosition.id },
          data: {
            shares: newTotalShares,
            avgCost: newAvgCost,
          },
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

      // Record trade
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

    console.log(`[AUTO-TRADER] BUY ${shares} ${decision.ticker} @ $${price.toFixed(2)} ($${totalCost.toFixed(2)})`);
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
  portfolio: Awaited<ReturnType<typeof getAutoPortfolio>>,
  decision: TradeDecision
): Promise<boolean> {
  try {
    const position = portfolio.positions.find(
      p => p.companyId === decision.companyId
    );
    if (!position) {
      console.log(`[AUTO-TRADER] No position to sell for ${decision.ticker}`);
      return false;
    }

    // Get current price
    const quote = await finnhub.getQuote(decision.ticker);
    if (!quote.c || quote.c <= 0) {
      console.error(`[AUTO-TRADER] Invalid price for ${decision.ticker}`);
      return false;
    }

    const price = quote.c;
    const sharesToSell = decision.suggestedShares || position.shares;
    const totalValue = sharesToSell * price;

    await prisma.$transaction(async (tx) => {
      // Update cash
      await tx.paperPortfolio.update({
        where: { id: portfolio.id },
        data: { currentCash: { increment: totalValue } },
      });

      // Update or delete position
      if (sharesToSell >= position.shares) {
        await tx.paperPosition.delete({
          where: { id: position.id },
        });
      } else {
        await tx.paperPosition.update({
          where: { id: position.id },
          data: { shares: { decrement: sharesToSell } },
        });
      }

      // Record trade
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
    console.log(`[AUTO-TRADER] SELL ${sharesToSell} ${decision.ticker} @ $${price.toFixed(2)} (${gainLoss}%)`);
    return true;
  } catch (error) {
    console.error(`[AUTO-TRADER] Failed to sell ${decision.ticker}:`, error);
    return false;
  }
}

/**
 * Main function: Execute trades based on current predictions
 */
async function executeFromPredictions(): Promise<AutoTradeResult> {
  const result: AutoTradeResult = {
    decisions: [],
    tradesExecuted: 0,
    buyOrders: 0,
    sellOrders: 0,
    errors: [],
  };

  console.log('\n========================================');
  console.log('[AUTO-TRADER] Starting auto-trade cycle');
  console.log('========================================\n');

  try {
    // Get portfolio
    const portfolio = await getAutoPortfolio();
    const portfolioValue = await calculatePortfolioValue(portfolio);
    console.log(`[AUTO-TRADER] Portfolio value: $${portfolioValue.toFixed(2)}`);
    console.log(`[AUTO-TRADER] Cash available: $${portfolio.currentCash.toFixed(2)}`);
    console.log(`[AUTO-TRADER] Current positions: ${portfolio.positions.length}`);

    // Check for sell signals first
    const sellDecisions = await checkSellSignals(portfolio);
    result.decisions.push(...sellDecisions);

    // Execute sells
    for (const decision of sellDecisions) {
      if (await executeSell(portfolio, decision)) {
        result.tradesExecuted++;
        result.sellOrders++;
      }
    }

    // Refresh portfolio after sells
    const updatedPortfolio = await getAutoPortfolio();
    const updatedValue = await calculatePortfolioValue(updatedPortfolio);

    // Check position limit
    if (updatedPortfolio.positions.length >= CONFIG.MAX_POSITIONS) {
      console.log('[AUTO-TRADER] Max positions reached, skipping buys');
    } else {
      // Analyze predictions for buy signals
      const buyDecisions = await analyzePredictions();

      // Filter out stocks we already own (unless adding to position)
      const filteredBuys = buyDecisions.filter(d => {
        const existing = updatedPortfolio.positions.find(p => p.companyId === d.companyId);
        if (!existing) return true;
        // Allow adding if under max single position
        const existingValue = existing.shares * existing.avgCost;
        return existingValue < updatedValue * CONFIG.MAX_SINGLE_POSITION;
      });

      result.decisions.push(...filteredBuys);

      // Execute buys (limit to available slots)
      const slotsAvailable = CONFIG.MAX_POSITIONS - updatedPortfolio.positions.length;
      const buysToExecute = filteredBuys.slice(0, slotsAvailable);

      for (const decision of buysToExecute) {
        if (await executeBuy(updatedPortfolio, decision, updatedValue)) {
          result.tradesExecuted++;
          result.buyOrders++;
        }
      }
    }

    console.log('\n========================================');
    console.log(`[AUTO-TRADER] Complete: ${result.tradesExecuted} trades executed`);
    console.log(`[AUTO-TRADER] Buys: ${result.buyOrders}, Sells: ${result.sellOrders}`);
    console.log('========================================\n');

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    result.errors.push(msg);
    console.error('[AUTO-TRADER] Error:', msg);
  }

  return result;
}

/**
 * Get auto-trader portfolio status
 */
async function getStatus() {
  const portfolio = await getAutoPortfolio();
  const portfolioValue = await calculatePortfolioValue(portfolio);

  const positions = await Promise.all(
    portfolio.positions.map(async (pos) => {
      try {
        const quote = await finnhub.getQuote(pos.ticker);
        const currentPrice = quote.c || pos.avgCost;
        const marketValue = pos.shares * currentPrice;
        const gainLoss = marketValue - (pos.shares * pos.avgCost);
        const gainLossPercent = (currentPrice - pos.avgCost) / pos.avgCost * 100;

        return {
          ...pos,
          currentPrice,
          marketValue,
          gainLoss,
          gainLossPercent,
        };
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
    config: CONFIG,
  };
}

export const autoTrader = {
  executeFromPredictions,
  getStatus,
  CONFIG,
};
