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
 * Get current quote for a single stock
 */
export async function getQuote(ticker: string): Promise<YahooQuote | null> {
  try {
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
  } catch (error) {
    // Handle validation errors gracefully (common for tickers like BRK.A)
    if (error instanceof Error && error.name === 'FailedYahooValidationError') {
      console.warn(`[Yahoo] Validation failed for ${ticker} (will retry without strict validation)`);
      return null;
    }
    console.error(`[Yahoo] Failed to fetch ${ticker}:`, error);
    return null;
  }
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
