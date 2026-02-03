/**
 * Stock Price Service
 * ===================
 * Fetches and stores stock prices from Yahoo Finance.
 * Supports all global exchanges (US, Canada, UK, Australia, Europe, etc.)
 *
 * Also evaluates pending predictions after fetching prices (backlog cleanup).
 *
 * Usage:
 *   import { stockPriceService } from '@/services/stock-price';
 *   await stockPriceService.fetchAllPrices();
 */

import { db } from '@/lib/db';
import { yahoofinance } from '@/lib/yahoofinance';

// ===========================================
// Types
// ===========================================

export interface StockPriceResult {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
}

export interface FetchPricesResult {
  fetched: number;
  failed: number;
  errors: string[];
  evaluated?: number;
  evaluatedCorrect?: number;
}

// ===========================================
// Main Functions
// ===========================================

/**
 * Fetch current quote for a single stock
 */
export async function fetchQuote(ticker: string): Promise<StockPriceResult | null> {
  try {
    const quote = await yahoofinance.getQuote(ticker);

    if (!quote || !quote.regularMarketPrice) {
      console.warn(`[StockPrice] Invalid quote for ${ticker} - may be delisted or invalid`);
      return null;
    }

    return {
      ticker,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      high: quote.regularMarketDayHigh,
      low: quote.regularMarketDayLow,
      open: quote.regularMarketOpen,
      previousClose: quote.regularMarketPreviousClose,
    };
  } catch (error) {
    console.error(`[StockPrice] Failed to fetch ${ticker}:`, error);
    return null;
  }
}

/**
 * Fetch quotes for multiple stocks
 */
export async function fetchQuotes(tickers: string[]): Promise<Map<string, StockPriceResult>> {
  const results = new Map<string, StockPriceResult>();

  for (const ticker of tickers) {
    const quote = await fetchQuote(ticker);
    if (quote) {
      results.set(ticker, quote);
    }
    // Yahoo Finance has no official rate limit, but be respectful
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * Store price snapshot in database (intraday or daily)
 */
export async function storePrice(
  companyId: string,
  timestamp: Date,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: bigint
): Promise<void> {
  // Normalize date component for date field (midnight UTC)
  const normalizedDate = new Date(Date.UTC(
    timestamp.getUTCFullYear(),
    timestamp.getUTCMonth(),
    timestamp.getUTCDate()
  ));

  // Use full timestamp for unique identification
  await db.stockPrice.upsert({
    where: {
      companyId_timestamp: {
        companyId,
        timestamp,
      },
    },
    update: {
      open,
      high,
      low,
      close,
      volume,
      date: normalizedDate, // Update date too
    },
    create: {
      companyId,
      timestamp,
      date: normalizedDate,
      open,
      high,
      low,
      close,
      volume,
    },
  });
}

/**
 * Store daily price (backward compatibility wrapper)
 */
export async function storeDailyPrice(
  companyId: string,
  date: Date,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: bigint
): Promise<void> {
  return storePrice(companyId, date, open, high, low, close, volume);
}

/**
 * Fetch and store prices with smart prioritization
 * Priority 0: Companies with unevaluated predictions (need price for evaluation!)
 * Priority 1: Companies with no prices yet
 * Priority 2: Companies with oldest prices (needs update)
 */
export async function fetchPricesPrioritized(limit: number = 30): Promise<FetchPricesResult> {
  const result: FetchPricesResult = {
    fetched: 0,
    failed: 0,
    errors: [],
  };

  const selectedCompanyIds = new Set<string>();
  const companies: Array<{ id: string; ticker: string }> = [];

  // Priority 0: Companies with unevaluated predictions that need current prices
  // These are blocking AI Performance evaluation!
  const predictionsNeedingPrices = await db.prediction.findMany({
    where: {
      wasCorrect: null, // Not yet evaluated
      targetDate: { lte: new Date() }, // Target date has passed
    },
    select: {
      companyId: true,
      company: { select: { id: true, ticker: true, isActive: true } },
    },
    distinct: ['companyId'],
    take: limit,
  });

  for (const pred of predictionsNeedingPrices) {
    if (pred.company.isActive && !selectedCompanyIds.has(pred.companyId)) {
      companies.push({ id: pred.company.id, ticker: pred.company.ticker });
      selectedCompanyIds.add(pred.companyId);
    }
  }
  const predictionsCount = companies.length;

  // Priority 1: Companies with no price data at all
  if (companies.length < limit) {
    const remaining = limit - companies.length;
    const companiesNoPrices = await db.company.findMany({
      where: {
        isActive: true,
        stockPrices: { none: {} },
        id: { notIn: Array.from(selectedCompanyIds) },
      },
      select: { id: true, ticker: true },
      take: remaining,
    });

    for (const c of companiesNoPrices) {
      if (!selectedCompanyIds.has(c.id)) {
        companies.push(c);
        selectedCompanyIds.add(c.id);
      }
    }
  }
  const noPricesCount = companies.length - predictionsCount;

  // Priority 2: Companies with oldest prices (if we have budget left)
  if (companies.length < limit) {
    const remaining = limit - companies.length;

    // Get companies ordered by oldest lastPriceCheckAt
    const companiesOldPrices = await db.company.findMany({
      where: {
        isActive: true,
        id: { notIn: Array.from(selectedCompanyIds) },
      },
      select: { id: true, ticker: true, lastPriceCheckAt: true },
      orderBy: { lastPriceCheckAt: 'asc' }, // Oldest first (null = never checked)
      take: remaining,
    });

    for (const c of companiesOldPrices) {
      if (!selectedCompanyIds.has(c.id)) {
        companies.push({ id: c.id, ticker: c.ticker });
        selectedCompanyIds.add(c.id);
      }
    }
  }
  const oldPricesCount = companies.length - predictionsCount - noPricesCount;

  console.log(`[StockPrice] Fetching ${companies.length} prices:`);
  console.log(`  - ${predictionsCount} with pending predictions (PRIORITY)`);
  console.log(`  - ${noPricesCount} with no price data`);
  console.log(`  - ${oldPricesCount} with stale prices`);

  // Use current timestamp for intraday snapshots
  const now = new Date();

  for (const company of companies) {
    try {
      const quote = await fetchQuote(company.ticker);

      if (quote) {
        // Store with current timestamp (enables intraday tracking)
        await storePrice(
          company.id,
          now,
          quote.open,
          quote.high,
          quote.low,
          quote.price,
          BigInt(0) // Volume not available from quote endpoint
        );
        result.fetched++;
        console.log(`[StockPrice] ${company.ticker}: $${quote.price.toFixed(2)} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)`);

        // Reset failure counter on success
        await db.company.update({
          where: { id: company.id },
          data: {
            priceCheckFailures: 0,
            lastPriceCheckAt: new Date(),
          },
        });
      } else {
        result.failed++;
        result.errors.push(`${company.ticker}: No valid quote`);

        // Increment failure counter
        const updatedCompany = await db.company.update({
          where: { id: company.id },
          data: {
            priceCheckFailures: { increment: 1 },
            lastPriceCheckAt: new Date(),
          },
        });

        // Blacklist after 5 failures
        if (updatedCompany.priceCheckFailures >= 5) {
          await db.company.update({
            where: { id: company.id },
            data: { isActive: false },
          });
          console.warn(`[StockPrice] ⚠️  BLACKLISTED ${company.ticker} after ${updatedCompany.priceCheckFailures} failed price checks`);
        }
      }

      // Yahoo Finance has no official rate limit, but be respectful
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      result.failed++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`${company.ticker}: ${errorMsg}`);

      // Increment failure counter on exception
      const updatedCompany = await db.company.update({
        where: { id: company.id },
        data: {
          priceCheckFailures: { increment: 1 },
          lastPriceCheckAt: new Date(),
        },
      });

      // Blacklist after 5 failures
      if (updatedCompany.priceCheckFailures >= 5) {
        await db.company.update({
          where: { id: company.id },
          data: { isActive: false },
        });
        console.warn(`[StockPrice] ⚠️  BLACKLISTED ${company.ticker} after ${updatedCompany.priceCheckFailures} failed price checks`);
      }
    }
  }

  console.log(`[StockPrice] Fetched ${result.fetched}, failed ${result.failed}`);

  // BACKLOG CLEANUP: Evaluate pending predictions for companies we just fetched
  // This prevents backlog from accumulating and timing out the run-predictions cron
  if (predictionsCount > 0) {
    console.log(`[StockPrice] Evaluating pending predictions as backlog cleanup...`);
    const evaluationStats = await evaluatePredictionsForCompanies(
      Array.from(selectedCompanyIds).slice(0, predictionsCount)
    );
    result.evaluated = evaluationStats.evaluated;
    result.evaluatedCorrect = evaluationStats.correct;
    console.log(`[StockPrice] Evaluated ${evaluationStats.evaluated} predictions: ${evaluationStats.correct} correct, ${evaluationStats.incorrect} incorrect`);
  }

  return result;
}

/**
 * Evaluate pending predictions for specific companies
 * Used by fetchPricesPrioritized for backlog cleanup
 */
async function evaluatePredictionsForCompanies(companyIds: string[]): Promise<{
  evaluated: number;
  correct: number;
  incorrect: number;
}> {
  const stats = { evaluated: 0, correct: 0, incorrect: 0 };

  // Get pending predictions for these companies
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const pendingPredictions = await db.prediction.findMany({
    where: {
      companyId: { in: companyIds },
      wasCorrect: null,
      targetDate: { lt: today },
    },
    include: {
      company: { select: { id: true, ticker: true } },
    },
  });

  for (const prediction of pendingPredictions) {
    try {
      // Get price change for the target date
      const targetDate = new Date(prediction.targetDate);
      const dayBefore = new Date(targetDate);
      dayBefore.setDate(dayBefore.getDate() - 1);

      const priceChange = await getPriceChange(
        prediction.companyId,
        dayBefore,
        targetDate
      );

      if (!priceChange) {
        continue; // Skip if no price data
      }

      // Determine actual direction
      const actualDirection =
        priceChange.changePercent > 0
          ? 'up'
          : priceChange.changePercent < 0
            ? 'down'
            : 'flat';

      // Check if prediction was correct
      const wasCorrect =
        actualDirection === 'flat'
          ? false
          : prediction.predictedDirection === actualDirection;

      // Update prediction
      await db.prediction.update({
        where: { id: prediction.id },
        data: {
          actualDirection,
          actualChange: priceChange.changePercent,
          wasCorrect,
          evaluatedAt: new Date(),
        },
      });

      stats.evaluated++;
      if (wasCorrect) {
        stats.correct++;
      } else {
        stats.incorrect++;
      }

      console.log(
        `[Evaluator] ${prediction.company.ticker} ${prediction.modelType}: ` +
        `Predicted ${prediction.predictedDirection.toUpperCase()}, ` +
        `Actual ${actualDirection.toUpperCase()} (${priceChange.changePercent >= 0 ? '+' : ''}${priceChange.changePercent.toFixed(2)}%) ` +
        `- ${wasCorrect ? 'CORRECT' : 'WRONG'}`
      );
    } catch (error) {
      console.error(`[Evaluator] Error evaluating ${prediction.company.ticker}:`, error);
    }
  }

  return stats;
}

/**
 * Fetch and store prices for all active companies
 * OPTIMIZED: Uses batched DB operations to reduce Prisma operation count
 * (Legacy function for backward compatibility - used by run-predictions)
 */
export async function fetchAllPrices(): Promise<FetchPricesResult> {
  const result: FetchPricesResult = {
    fetched: 0,
    failed: 0,
    errors: [],
  };

  // Get all active companies
  const companies = await db.company.findMany({
    where: { isActive: true },
    select: { id: true, ticker: true },
  });

  console.log(`[StockPrice] Fetching prices for ${companies.length} companies`);

  // Use current timestamp for intraday snapshots
  const now = new Date();

  // BATCHING: Collect data for batch operations
  const successfulIds: string[] = [];
  const priceData: Array<{
    companyId: string;
    timestamp: Date;
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: bigint;
  }> = [];
  const failedCompanies: Array<{ id: string; ticker: string }> = [];

  for (const company of companies) {
    try {
      const quote = await fetchQuote(company.ticker);

      if (quote) {
        // Queue price for batch insert
        const normalizedDate = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate()
        ));
        priceData.push({
          companyId: company.id,
          timestamp: now,
          date: normalizedDate,
          open: quote.open,
          high: quote.high,
          low: quote.low,
          close: quote.price,
          volume: BigInt(0),
        });
        successfulIds.push(company.id);
        result.fetched++;
        console.log(`[StockPrice] ${company.ticker}: $${quote.price.toFixed(2)} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)`);
      } else {
        result.failed++;
        result.errors.push(`${company.ticker}: No valid quote`);
        failedCompanies.push(company);
      }

      // Yahoo Finance has no official rate limit, but be respectful
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      result.failed++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`${company.ticker}: ${errorMsg}`);
      failedCompanies.push(company);
    }
  }

  // BATCH WRITE: Execute all DB operations in minimal calls
  console.log(`[DB] Batching ${priceData.length} prices and ${successfulIds.length} company updates...`);

  // Batch 1: Create all prices (1 operation instead of N)
  if (priceData.length > 0) {
    await db.stockPrice.createMany({
      data: priceData,
      skipDuplicates: true, // In case of duplicate timestamps
    });
  }

  // Batch 2: Reset failure counter for successful companies (1 operation instead of N)
  if (successfulIds.length > 0) {
    await db.company.updateMany({
      where: { id: { in: successfulIds } },
      data: {
        priceCheckFailures: 0,
        lastPriceCheckAt: new Date(),
      },
    });
  }

  // Handle failures individually (need to check count for blacklisting)
  for (const company of failedCompanies) {
    const updatedCompany = await db.company.update({
      where: { id: company.id },
      data: {
        priceCheckFailures: { increment: 1 },
        lastPriceCheckAt: new Date(),
      },
    });

    // Blacklist after 5 failures
    if (updatedCompany.priceCheckFailures >= 5) {
      await db.company.update({
        where: { id: company.id },
        data: { isActive: false },
      });
      console.warn(`[StockPrice] ⚠️  BLACKLISTED ${company.ticker} after ${updatedCompany.priceCheckFailures} failed price checks`);
    }
  }

  console.log(`[StockPrice] Fetched ${result.fetched}, failed ${result.failed}`);
  return result;
}

/**
 * Get latest price for a company
 */
export async function getLatestPrice(
  companyId: string
): Promise<{ close: number; date: Date } | null> {
  const price = await db.stockPrice.findFirst({
    where: { companyId },
    orderBy: { date: 'desc' },
  });

  return price ? { close: price.close, date: price.date } : null;
}

/**
 * Calculate price change between two dates
 */
export async function getPriceChange(
  companyId: string,
  fromDate: Date,
  toDate: Date
): Promise<{ change: number; changePercent: number } | null> {
  const [fromPrice, toPrice] = await Promise.all([
    db.stockPrice.findFirst({
      where: { companyId, date: { lte: fromDate } },
      orderBy: { date: 'desc' },
    }),
    db.stockPrice.findFirst({
      where: { companyId, date: { lte: toDate } },
      orderBy: { date: 'desc' },
    }),
  ]);

  if (!fromPrice || !toPrice) {
    return null;
  }

  const change = toPrice.close - fromPrice.close;
  const changePercent = (change / fromPrice.close) * 100;

  return { change, changePercent };
}

/**
 * Get recent price history
 */
export async function getPriceHistory(
  companyId: string,
  days: number = 30
): Promise<Array<{ date: Date; close: number }>> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const prices = await db.stockPrice.findMany({
    where: {
      companyId,
      date: { gte: cutoff },
    },
    orderBy: { date: 'asc' },
    select: { date: true, close: true },
  });

  return prices;
}

/**
 * Calculate volatility (standard deviation of daily returns)
 */
export async function calculateVolatility(
  companyId: string,
  days: number = 7
): Promise<number | null> {
  const prices = await getPriceHistory(companyId, days);

  if (prices.length < 2) {
    return null;
  }

  // Calculate daily returns
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const dailyReturn = (prices[i].close - prices[i - 1].close) / prices[i - 1].close;
    returns.push(dailyReturn);
  }

  // Calculate standard deviation
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  return stdDev;
}

/**
 * Calculate price momentum (recent price trend)
 */
export async function calculateMomentum(
  companyId: string,
  days: number = 5
): Promise<number | null> {
  const prices = await getPriceHistory(companyId, days);

  if (prices.length < 2) {
    return null;
  }

  const firstPrice = prices[0].close;
  const lastPrice = prices[prices.length - 1].close;

  return (lastPrice - firstPrice) / firstPrice;
}

// Export as namespace
export const stockPriceService = {
  fetchQuote,
  fetchQuotes,
  storePrice,
  storeDailyPrice,
  fetchPricesPrioritized,
  fetchAllPrices,
  getLatestPrice,
  getPriceChange,
  getPriceHistory,
  calculateVolatility,
  calculateMomentum,
};
