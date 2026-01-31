/**
 * StockTwits API Client
 * =====================
 * Fetches stock-related social posts from StockTwits.
 * Free tier: 200 requests/hour per IP.
 *
 * Usage:
 *   import { stocktwits } from '@/lib/stocktwits';
 *   const messages = await stocktwits.getSymbolStream('TSLA');
 */

import type { XTweet, Sentiment } from '@/types';

const STOCKTWITS_BASE_URL = 'https://api.stocktwits.com/api/2';

// StockTwits API response types
interface StocktwitsMessage {
  id: number;
  body: string;
  created_at: string;
  user: {
    id: number;
    username: string;
    name: string;
    followers: number;
    following: number;
  };
  source?: {
    id: number;
    title: string;
    url: string;
  };
  entities?: {
    sentiment?: {
      basic: 'Bullish' | 'Bearish' | null;
    };
  };
  likes?: {
    total: number;
  };
}

interface SymbolStreamResponse {
  response: {
    status: number;
  };
  symbol: {
    id: number;
    symbol: string;
    title: string;
  };
  messages: StocktwitsMessage[];
  cursor?: {
    more: boolean;
    since: number;
    max: number;
  };
}

interface TrendingSymbolsResponse {
  response: {
    status: number;
  };
  symbols: Array<{
    id: number;
    symbol: string;
    title: string;
    watchlist_count: number;
  }>;
}

/**
 * Get message stream for a specific symbol
 */
export async function getSymbolStream(
  symbol: string,
  options: { limit?: number } = {}
): Promise<XTweet[]> {
  const limit = options.limit || 30;

  try {
    const url = `${STOCKTWITS_BASE_URL}/streams/symbol/${symbol}.json?limit=${limit}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MarketPredictor/1.0',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[StockTwits] Symbol not found: ${symbol}`);
        return [];
      }
      throw new Error(`StockTwits API error: ${response.status}`);
    }

    const data: SymbolStreamResponse = await response.json();

    // Convert to XTweet format for compatibility
    return data.messages.map((msg) => convertToXTweet(msg, symbol));
  } catch (error) {
    console.error(`[StockTwits] Error fetching ${symbol}:`, error);
    return [];
  }
}

/**
 * Get trending symbols on StockTwits
 */
export async function getTrendingSymbols(limit: number = 30): Promise<string[]> {
  try {
    const url = `${STOCKTWITS_BASE_URL}/trending/symbols.json?limit=${limit}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MarketPredictor/1.0',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`StockTwits API error: ${response.status}`);
    }

    const data: TrendingSymbolsResponse = await response.json();
    return data.symbols.map((s) => s.symbol);
  } catch (error) {
    console.error('[StockTwits] Error fetching trending:', error);
    return [];
  }
}

/**
 * Get messages for multiple symbols
 */
export async function getMultipleSymbolStreams(
  symbols: string[],
  options: { limitPerSymbol?: number } = {}
): Promise<Map<string, XTweet[]>> {
  const results = new Map<string, XTweet[]>();
  const limit = options.limitPerSymbol || 20;

  for (const symbol of symbols) {
    // Delay between requests to respect rate limits
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await getSymbolStream(symbol, { limit });
    if (messages.length > 0) {
      results.set(symbol, messages);
    }
  }

  return results;
}

/**
 * Convert StockTwits message to XTweet format
 */
function convertToXTweet(msg: StocktwitsMessage, symbol: string): XTweet {
  // Extract all cashtags from the message body
  const cashtags: { start: number; end: number; tag: string }[] = [];
  const cashtagRegex = /\$([A-Z]{1,5})\b/g;
  let match;
  while ((match = cashtagRegex.exec(msg.body)) !== null) {
    cashtags.push({
      start: match.index,
      end: match.index + match[0].length,
      tag: match[1],
    });
  }

  // If no cashtags found in text, add the symbol we queried for
  if (cashtags.length === 0) {
    cashtags.push({
      start: 0,
      end: symbol.length + 1,
      tag: symbol,
    });
  }

  return {
    id: msg.id.toString(),
    text: msg.body,
    created_at: new Date(msg.created_at).toISOString(),
    entities: {
      cashtags,
    },
    public_metrics: {
      like_count: msg.likes?.total || 0,
      retweet_count: 0, // StockTwits doesn't have retweets
      reply_count: 0,
      quote_count: 0,
    },
  };
}

/**
 * Extract sentiment from StockTwits message
 */
export function extractSentiment(msg: StocktwitsMessage): Sentiment | null {
  const stSentiment = msg.entities?.sentiment?.basic;
  if (stSentiment === 'Bullish') return 'positive';
  if (stSentiment === 'Bearish') return 'negative';
  return null;
}

/**
 * Calculate aggregate sentiment for a symbol
 */
export async function getSymbolSentiment(
  symbol: string
): Promise<{ bullish: number; bearish: number; total: number }> {
  const messages = await getSymbolStream(symbol, { limit: 30 });

  let bullish = 0;
  let bearish = 0;

  for (const msg of messages) {
    const text = msg.text.toLowerCase();
    // Simple keyword-based sentiment (since we don't have the original StockTwits sentiment)
    if (
      text.includes('bullish') ||
      text.includes('buy') ||
      text.includes('moon') ||
      text.includes('🚀')
    ) {
      bullish++;
    } else if (
      text.includes('bearish') ||
      text.includes('sell') ||
      text.includes('short') ||
      text.includes('dump')
    ) {
      bearish++;
    }
  }

  return {
    bullish,
    bearish,
    total: messages.length,
  };
}

/**
 * Check if StockTwits API is available
 */
export async function isAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${STOCKTWITS_BASE_URL}/trending/symbols.json?limit=1`);
    return response.ok;
  } catch {
    return false;
  }
}

// Export as namespace
export const stocktwits = {
  getSymbolStream,
  getTrendingSymbols,
  getMultipleSymbolStreams,
  extractSentiment,
  getSymbolSentiment,
  isAvailable,
};
