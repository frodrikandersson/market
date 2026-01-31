/**
 * Finnhub API Client
 * ==================
 * Client for interacting with Finnhub Stock API.
 * Provides stock quotes, historical data, and company news.
 *
 * API Documentation: https://finnhub.io/docs/api
 * Rate Limits: 60 calls/minute (free tier)
 *
 * Usage:
 *   import { finnhub } from '@/lib/finnhub';
 *   const quote = await finnhub.getQuote('AAPL');
 */

import type {
  FinnhubQuote,
  FinnhubCandles,
  FinnhubNewsArticle,
} from '@/types';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

/**
 * Get Finnhub API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    throw new Error('FINNHUB_API_KEY environment variable is not set');
  }
  return apiKey;
}

/**
 * Make a request to Finnhub API
 */
async function fetchFinnhub<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${FINNHUB_BASE_URL}${endpoint}`);
  url.searchParams.set('token', getApiKey());

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json',
    },
    next: { revalidate: 60 }, // Cache for 1 minute
  });

  if (!response.ok) {
    throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get current stock quote
 *
 * @example
 * const quote = await finnhub.getQuote('AAPL');
 * console.log(quote.c); // Current price: 178.72
 */
export async function getQuote(symbol: string): Promise<FinnhubQuote> {
  return fetchFinnhub<FinnhubQuote>('/quote', { symbol });
}

/**
 * Get historical stock candles (OHLCV data)
 *
 * @param symbol - Stock ticker (e.g., 'AAPL')
 * @param resolution - Time resolution: D (daily), W (weekly), M (monthly), or minutes (1, 5, 15, 30, 60)
 * @param from - Start timestamp (Unix)
 * @param to - End timestamp (Unix)
 *
 * @example
 * const candles = await finnhub.getCandles('AAPL', 'D', startTimestamp, endTimestamp);
 */
export async function getCandles(
  symbol: string,
  resolution: 'D' | 'W' | 'M' | '1' | '5' | '15' | '30' | '60',
  from: number,
  to: number
): Promise<FinnhubCandles> {
  return fetchFinnhub<FinnhubCandles>('/stock/candle', {
    symbol,
    resolution,
    from: from.toString(),
    to: to.toString(),
  });
}

/**
 * Get daily candles for the last N days
 *
 * @param symbol - Stock ticker
 * @param days - Number of days of history (default: 30)
 */
export async function getDailyCandles(
  symbol: string,
  days: number = 30
): Promise<FinnhubCandles> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - days * 24 * 60 * 60;
  return getCandles(symbol, 'D', from, now);
}

/**
 * Get company news
 *
 * @param symbol - Stock ticker (e.g., 'AAPL')
 * @param from - Start date (YYYY-MM-DD)
 * @param to - End date (YYYY-MM-DD)
 *
 * @example
 * const news = await finnhub.getCompanyNews('AAPL', '2024-01-01', '2024-01-07');
 */
export async function getCompanyNews(
  symbol: string,
  from: string,
  to: string
): Promise<FinnhubNewsArticle[]> {
  return fetchFinnhub<FinnhubNewsArticle[]>('/company-news', {
    symbol,
    from,
    to,
  });
}

/**
 * Get general market news
 *
 * @param category - News category: general, forex, crypto, merger
 *
 * @example
 * const news = await finnhub.getMarketNews('general');
 */
export async function getMarketNews(
  category: 'general' | 'forex' | 'crypto' | 'merger' = 'general'
): Promise<FinnhubNewsArticle[]> {
  return fetchFinnhub<FinnhubNewsArticle[]>('/news', { category });
}

/**
 * Get company profile information
 */
export interface CompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  finnhubIndustry: string;
  ipo: string;
  logo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
}

export async function getCompanyProfile(symbol: string): Promise<CompanyProfile> {
  return fetchFinnhub<CompanyProfile>('/stock/profile2', { symbol });
}

/**
 * Convert Finnhub candles to array of daily data
 */
export function candlesToDailyData(candles: FinnhubCandles): Array<{
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}> {
  if (candles.s !== 'ok' || !candles.t || candles.t.length === 0) {
    return [];
  }

  return candles.t.map((timestamp, i) => ({
    date: new Date(timestamp * 1000),
    open: candles.o[i],
    high: candles.h[i],
    low: candles.l[i],
    close: candles.c[i],
    volume: candles.v[i],
  }));
}

/**
 * Format date for Finnhub API (YYYY-MM-DD)
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Export as namespace for cleaner imports
export const finnhub = {
  getQuote,
  getCandles,
  getDailyCandles,
  getCompanyNews,
  getMarketNews,
  getCompanyProfile,
  candlesToDailyData,
  formatDate,
};
