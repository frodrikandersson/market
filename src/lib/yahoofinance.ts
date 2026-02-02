/**
 * Yahoo Finance API Client
 * ========================
 * Free API for stock quotes supporting all global exchanges.
 * No API key required, no rate limits (reasonable use).
 *
 * Supports tickers like:
 * - US: AAPL, TSLA, GOOGL
 * - Canada: AG.TO
 * - UK: RIO.L
 * - Australia: BHP.AX
 * - Europe: MC.PA
 */

import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

// Rate limiting: Track last request time
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 300; // 300ms between requests

// Types matching our StockPriceResult interface
export interface YahooQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketOpen: number;
  regularMarketPreviousClose: number;
  regularMarketVolume?: number;
}

/**
 * Sleep for specified milliseconds
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Rate limiter: Ensure minimum interval between requests
 */
async function rateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await sleep(waitTime);
  }

  lastRequestTime = Date.now();
}

/**
 * Get current quote for a single stock with retry logic
 */
export async function getQuote(ticker: string, retries = 3): Promise<YahooQuote | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Rate limit before making request
      await rateLimit();

      const quote = await yahooFinance.quote(ticker, {}, { validateResult: false });

      if (!quote || !quote.regularMarketPrice) {
        console.warn(`[Yahoo] No valid quote for ${ticker}`);
        return null;
      }

      return {
        symbol: quote.symbol,
        regularMarketPrice: quote.regularMarketPrice,
        regularMarketChange: quote.regularMarketChange ?? 0,
        regularMarketChangePercent: quote.regularMarketChangePercent ?? 0,
        regularMarketDayHigh: quote.regularMarketDayHigh ?? quote.regularMarketPrice,
        regularMarketDayLow: quote.regularMarketDayLow ?? quote.regularMarketPrice,
        regularMarketOpen: quote.regularMarketOpen ?? quote.regularMarketPrice,
        regularMarketPreviousClose: quote.regularMarketPreviousClose ?? quote.regularMarketPrice,
        regularMarketVolume: quote.regularMarketVolume,
      };
    } catch (error: any) {
      // Handle validation errors gracefully (common for tickers like BRK.A)
      if (error instanceof Error && error.name === 'FailedYahooValidationError') {
        console.warn(`[Yahoo] Validation failed for ${ticker}`);
        return null;
      }

      // Handle rate limit errors (429)
      if (error?.code === 429 || error?.message?.includes('Too Many Requests')) {
        if (attempt < retries) {
          const backoffTime = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
          console.warn(`[Yahoo] Rate limited on ${ticker}, retrying in ${backoffTime}ms (attempt ${attempt}/${retries})`);
          await sleep(backoffTime);
          continue;
        }
        console.error(`[Yahoo] Rate limit exceeded for ${ticker} after ${retries} attempts`);
        return null;
      }

      console.error(`[Yahoo] Failed to fetch ${ticker}:`, error);
      return null;
    }
  }

  return null;
}

/**
 * Get quotes for multiple stocks (batch)
 */
export async function getQuotes(tickers: string[]): Promise<Map<string, YahooQuote>> {
  const results = new Map<string, YahooQuote>();

  // Yahoo Finance allows batch requests, but we'll do one at a time for reliability
  for (const ticker of tickers) {
    const quote = await getQuote(ticker);
    if (quote) {
      results.set(ticker, quote);
    }
    // Small delay to be respectful (no official rate limit)
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * Get historical data for a stock
 */
export async function getHistorical(
  ticker: string,
  startDate: Date,
  endDate: Date = new Date()
) {
  try {
    const result = await yahooFinance.historical(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    });

    return result;
  } catch (error) {
    console.error(`[Yahoo] Failed to fetch historical data for ${ticker}:`, error);
    return [];
  }
}

export const yahoofinance = {
  getQuote,
  getQuotes,
  getHistorical,
};
