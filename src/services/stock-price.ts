/**
 * Stock Price Service
 * ===================
 * Fetches and stores stock prices from Finnhub.
 *
 * Usage:
 *   import { stockPriceService } from '@/services/stock-price';
 *   await stockPriceService.fetchAllPrices();
 */

import { db } from '@/lib/db';
import { finnhub } from '@/lib/finnhub';

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
}

// ===========================================
// Main Functions
// ===========================================

/**
 * Fetch current quote for a single stock
 */
export async function fetchQuote(ticker: string): Promise<StockPriceResult | null> {
  try {
    const quote = await finnhub.getQuote(ticker);

    // Validate the quote (Finnhub returns zeros for invalid tickers)
    if (quote.c === 0 && quote.h === 0 && quote.l === 0) {
      console.warn(`[StockPrice] Invalid quote for ${ticker} - may be delisted or invalid`);
      return null;
    }

    return {
      ticker,
      price: quote.c,
      change: quote.d,
      changePercent: quote.dp,
      high: quote.h,
      low: quote.l,
      open: quote.o,
      previousClose: quote.pc,
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
    // Rate limit: 60 calls/min = 1 per second max
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * Store daily price in database
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
  // Normalize date to midnight UTC
  const d = new Date(date);
  const normalizedDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

  await db.stockPrice.upsert({
    where: {
      companyId_date: {
        companyId,
        date: normalizedDate,
      },
    },
    update: {
      open,
      high,
      low,
      close,
      volume,
    },
    create: {
      companyId,
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
 * Fetch and store prices for all active companies
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

  // Use UTC for consistent date handling
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  for (const company of companies) {
    try {
      const quote = await fetchQuote(company.ticker);

      if (quote) {
        // Store as today's price
        await storeDailyPrice(
          company.id,
          today,
          quote.open,
          quote.high,
          quote.low,
          quote.price,
          BigInt(0) // Volume not available from quote endpoint
        );
        result.fetched++;
        console.log(`[StockPrice] ${company.ticker}: $${quote.price.toFixed(2)} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)`);
      } else {
        result.failed++;
        result.errors.push(`${company.ticker}: No valid quote`);
      }

      // Rate limit delay
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      result.failed++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`${company.ticker}: ${errorMsg}`);
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
  storeDailyPrice,
  fetchAllPrices,
  getLatestPrice,
  getPriceChange,
  getPriceHistory,
  calculateVolatility,
  calculateMomentum,
};
