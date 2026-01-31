/**
 * Paper Trading Service
 * =====================
 * Simulates stock trading with virtual money.
 * Track positions, execute trades, and calculate P&L.
 *
 * Usage:
 *   import { paperTrading } from '@/services/paper-trading';
 *   await paperTrading.executeTrade({ ... });
 */

import { db } from '@/lib/db';
import { finnhub } from '@/lib/finnhub';

// ===========================================
// Types
// ===========================================

export interface Portfolio {
  id: string;
  name: string;
  startingCash: number;
  currentCash: number;
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  positions: Position[];
  createdAt: Date;
}

export interface Position {
  id: string;
  ticker: string;
  companyId: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  gainLoss: number;
  gainLossPercent: number;
}

export interface TradeRequest {
  portfolioId: string;
  ticker: string;
  type: 'buy' | 'sell';
  shares: number;
  predictionId?: string;
  modelType?: string;
  note?: string;
}

export interface TradeResult {
  success: boolean;
  trade?: {
    id: string;
    ticker: string;
    type: string;
    shares: number;
    price: number;
    totalValue: number;
  };
  error?: string;
  newCashBalance?: number;
}

export interface TradeHistoryItem {
  id: string;
  ticker: string;
  type: 'buy' | 'sell';
  shares: number;
  price: number;
  totalValue: number;
  executedAt: Date;
  note: string | null;
  modelType: string | null;
}

// ===========================================
// Portfolio Management
// ===========================================

/**
 * Get or create the default portfolio
 */
export async function getOrCreatePortfolio(startingCash: number = 100000): Promise<string> {
  // Check for existing active portfolio
  let portfolio = await db.paperPortfolio.findFirst({
    where: { isActive: true },
  });

  if (!portfolio) {
    // Create new portfolio
    portfolio = await db.paperPortfolio.create({
      data: {
        name: 'My Portfolio',
        startingCash,
        currentCash: startingCash,
      },
    });
    console.log(`[PaperTrading] Created new portfolio with $${startingCash.toLocaleString()}`);
  }

  return portfolio.id;
}

/**
 * Get portfolio with current positions and valuations
 */
export async function getPortfolio(portfolioId: string): Promise<Portfolio | null> {
  const portfolio = await db.paperPortfolio.findUnique({
    where: { id: portfolioId },
    include: {
      positions: true,
    },
  });

  if (!portfolio) return null;

  // Get current prices for all positions
  const positions: Position[] = [];
  let totalPositionsValue = 0;

  for (const pos of portfolio.positions) {
    try {
      const quote = await finnhub.getQuote(pos.ticker);
      const currentPrice = quote.c || pos.avgCost;
      const marketValue = pos.shares * currentPrice;
      const costBasis = pos.shares * pos.avgCost;
      const gainLoss = marketValue - costBasis;
      const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

      positions.push({
        id: pos.id,
        ticker: pos.ticker,
        companyId: pos.companyId,
        shares: pos.shares,
        avgCost: pos.avgCost,
        currentPrice,
        marketValue,
        gainLoss,
        gainLossPercent,
      });

      totalPositionsValue += marketValue;
    } catch (error) {
      // If quote fails, use avg cost
      const marketValue = pos.shares * pos.avgCost;
      positions.push({
        id: pos.id,
        ticker: pos.ticker,
        companyId: pos.companyId,
        shares: pos.shares,
        avgCost: pos.avgCost,
        currentPrice: pos.avgCost,
        marketValue,
        gainLoss: 0,
        gainLossPercent: 0,
      });
      totalPositionsValue += marketValue;
    }
  }

  const totalValue = portfolio.currentCash + totalPositionsValue;
  const totalGainLoss = totalValue - portfolio.startingCash;
  const totalGainLossPercent = (totalGainLoss / portfolio.startingCash) * 100;

  return {
    id: portfolio.id,
    name: portfolio.name,
    startingCash: portfolio.startingCash,
    currentCash: portfolio.currentCash,
    totalValue,
    totalGainLoss,
    totalGainLossPercent,
    positions: positions.sort((a, b) => b.marketValue - a.marketValue),
    createdAt: portfolio.createdAt,
  };
}

/**
 * Reset portfolio to starting state
 */
export async function resetPortfolio(portfolioId: string): Promise<void> {
  const portfolio = await db.paperPortfolio.findUnique({
    where: { id: portfolioId },
  });

  if (!portfolio) throw new Error('Portfolio not found');

  // Delete all positions and trades
  await db.paperPosition.deleteMany({ where: { portfolioId } });
  await db.paperTrade.deleteMany({ where: { portfolioId } });

  // Reset cash to starting amount
  await db.paperPortfolio.update({
    where: { id: portfolioId },
    data: { currentCash: portfolio.startingCash },
  });

  console.log(`[PaperTrading] Reset portfolio to $${portfolio.startingCash.toLocaleString()}`);
}

// ===========================================
// Trading Functions
// ===========================================

/**
 * Execute a trade (buy or sell)
 */
export async function executeTrade(request: TradeRequest): Promise<TradeResult> {
  const { portfolioId, ticker, type, shares, predictionId, modelType, note } = request;

  if (shares <= 0) {
    return { success: false, error: 'Shares must be greater than 0' };
  }

  // Get portfolio
  const portfolio = await db.paperPortfolio.findUnique({
    where: { id: portfolioId },
  });

  if (!portfolio) {
    return { success: false, error: 'Portfolio not found' };
  }

  // Get current stock price
  let currentPrice: number;
  try {
    const quote = await finnhub.getQuote(ticker.toUpperCase());
    if (!quote.c || quote.c === 0) {
      return { success: false, error: `Unable to get price for ${ticker}` };
    }
    currentPrice = quote.c;
  } catch (error) {
    return { success: false, error: `Failed to fetch price for ${ticker}` };
  }

  // Get or find company
  let company = await db.company.findUnique({
    where: { ticker: ticker.toUpperCase() },
  });

  if (!company) {
    // Try to get company info from Finnhub
    try {
      const profile = await finnhub.getCompanyProfile(ticker.toUpperCase());
      company = await db.company.create({
        data: {
          ticker: ticker.toUpperCase(),
          name: profile.name || ticker.toUpperCase(),
          sector: profile.finnhubIndustry || null,
          marketCap: profile.marketCapitalization ? profile.marketCapitalization * 1000000 : null,
        },
      });
    } catch {
      // Create minimal company record
      company = await db.company.create({
        data: {
          ticker: ticker.toUpperCase(),
          name: ticker.toUpperCase(),
        },
      });
    }
  }

  const totalValue = shares * currentPrice;

  if (type === 'buy') {
    // Check if enough cash
    if (totalValue > portfolio.currentCash) {
      return {
        success: false,
        error: `Insufficient funds. Need $${totalValue.toFixed(2)}, have $${portfolio.currentCash.toFixed(2)}`,
      };
    }

    // Update or create position
    const existingPosition = await db.paperPosition.findUnique({
      where: {
        portfolioId_companyId: {
          portfolioId,
          companyId: company.id,
        },
      },
    });

    if (existingPosition) {
      // Update existing position (average in)
      const totalShares = existingPosition.shares + shares;
      const totalCost = existingPosition.shares * existingPosition.avgCost + totalValue;
      const newAvgCost = totalCost / totalShares;

      await db.paperPosition.update({
        where: { id: existingPosition.id },
        data: {
          shares: totalShares,
          avgCost: newAvgCost,
        },
      });
    } else {
      // Create new position
      await db.paperPosition.create({
        data: {
          portfolioId,
          companyId: company.id,
          ticker: ticker.toUpperCase(),
          shares,
          avgCost: currentPrice,
        },
      });
    }

    // Deduct cash
    await db.paperPortfolio.update({
      where: { id: portfolioId },
      data: { currentCash: portfolio.currentCash - totalValue },
    });

  } else {
    // SELL
    const existingPosition = await db.paperPosition.findUnique({
      where: {
        portfolioId_companyId: {
          portfolioId,
          companyId: company.id,
        },
      },
    });

    if (!existingPosition) {
      return { success: false, error: `No position in ${ticker} to sell` };
    }

    if (shares > existingPosition.shares) {
      return {
        success: false,
        error: `Cannot sell ${shares} shares, only have ${existingPosition.shares}`,
      };
    }

    const remainingShares = existingPosition.shares - shares;

    if (remainingShares === 0) {
      // Close position
      await db.paperPosition.delete({ where: { id: existingPosition.id } });
    } else {
      // Reduce position
      await db.paperPosition.update({
        where: { id: existingPosition.id },
        data: { shares: remainingShares },
      });
    }

    // Add cash
    await db.paperPortfolio.update({
      where: { id: portfolioId },
      data: { currentCash: portfolio.currentCash + totalValue },
    });
  }

  // Record trade
  const trade = await db.paperTrade.create({
    data: {
      portfolioId,
      companyId: company.id,
      ticker: ticker.toUpperCase(),
      type,
      shares,
      price: currentPrice,
      totalValue,
      predictionId,
      modelType,
      note,
    },
  });

  console.log(
    `[PaperTrading] ${type.toUpperCase()} ${shares} ${ticker} @ $${currentPrice.toFixed(2)} = $${totalValue.toFixed(2)}`
  );

  const updatedPortfolio = await db.paperPortfolio.findUnique({
    where: { id: portfolioId },
  });

  return {
    success: true,
    trade: {
      id: trade.id,
      ticker: trade.ticker,
      type: trade.type,
      shares: trade.shares,
      price: trade.price,
      totalValue: trade.totalValue,
    },
    newCashBalance: updatedPortfolio?.currentCash,
  };
}

/**
 * Get trade history
 */
export async function getTradeHistory(
  portfolioId: string,
  limit: number = 50
): Promise<TradeHistoryItem[]> {
  const trades = await db.paperTrade.findMany({
    where: { portfolioId },
    orderBy: { executedAt: 'desc' },
    take: limit,
  });

  return trades.map((t) => ({
    id: t.id,
    ticker: t.ticker,
    type: t.type as 'buy' | 'sell',
    shares: t.shares,
    price: t.price,
    totalValue: t.totalValue,
    executedAt: t.executedAt,
    note: t.note,
    modelType: t.modelType,
  }));
}

/**
 * Calculate performance metrics
 */
export async function getPerformanceMetrics(portfolioId: string): Promise<{
  totalTrades: number;
  buyTrades: number;
  sellTrades: number;
  totalVolume: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgGainPercent: number;
  avgLossPercent: number;
}> {
  const trades = await db.paperTrade.findMany({
    where: { portfolioId },
    orderBy: { executedAt: 'asc' },
  });

  const buyTrades = trades.filter((t) => t.type === 'buy');
  const sellTrades = trades.filter((t) => t.type === 'sell');
  const totalVolume = trades.reduce((sum, t) => sum + t.totalValue, 0);

  // Track completed round-trips (buy then sell)
  const positionTracker = new Map<string, { shares: number; cost: number }>();
  let winningTrades = 0;
  let losingTrades = 0;
  const gains: number[] = [];
  const losses: number[] = [];

  for (const trade of trades) {
    if (trade.type === 'buy') {
      const existing = positionTracker.get(trade.ticker) || { shares: 0, cost: 0 };
      existing.shares += trade.shares;
      existing.cost += trade.totalValue;
      positionTracker.set(trade.ticker, existing);
    } else {
      const existing = positionTracker.get(trade.ticker);
      if (existing && existing.shares > 0) {
        const avgCost = existing.cost / existing.shares;
        const profit = (trade.price - avgCost) * trade.shares;
        const profitPercent = ((trade.price - avgCost) / avgCost) * 100;

        if (profit > 0) {
          winningTrades++;
          gains.push(profitPercent);
        } else {
          losingTrades++;
          losses.push(profitPercent);
        }

        // Update tracker
        existing.shares -= trade.shares;
        existing.cost = existing.shares > 0 ? existing.cost - trade.shares * avgCost : 0;
        positionTracker.set(trade.ticker, existing);
      }
    }
  }

  const completedTrades = winningTrades + losingTrades;
  const winRate = completedTrades > 0 ? (winningTrades / completedTrades) * 100 : 0;
  const avgGainPercent = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
  const avgLossPercent = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;

  return {
    totalTrades: trades.length,
    buyTrades: buyTrades.length,
    sellTrades: sellTrades.length,
    totalVolume,
    winningTrades,
    losingTrades,
    winRate,
    avgGainPercent,
    avgLossPercent,
  };
}

// Export as namespace
export const paperTrading = {
  getOrCreatePortfolio,
  getPortfolio,
  resetPortfolio,
  executeTrade,
  getTradeHistory,
  getPerformanceMetrics,
};
