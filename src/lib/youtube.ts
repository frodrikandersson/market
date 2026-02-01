/**
 * YouTube Financial Content Analyzer
 * ===================================
 * Fetches and analyzes financial content from YouTube channels.
 * Focuses on CNBC, Bloomberg, and other financial news channels.
 *
 * Requirements:
 * - YouTube Data API v3 key (free tier: 10,000 quota/day)
 * - Set YOUTUBE_API_KEY in .env
 *
 * Limitations:
 * - Free tier allows ~100 searches per day
 * - Transcript extraction requires additional API or scraping
 *
 * Usage:
 *   import { youtube } from '@/lib/youtube';
 *   const videos = await youtube.getFinancialVideos();
 */

import type { NewsAPIArticle } from '@/types';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_BASE_URL = 'https://www.googleapis.com/youtube/v3';

// ===========================================
// Financial YouTube Channels
// ===========================================

export const FINANCIAL_CHANNELS = {
  cnbc: {
    id: 'UCrp_UI8XtuYfpiqluWLD7Lw',
    name: 'CNBC Television',
    weight: 0.9,
  },
  bloombergTV: {
    id: 'UCIALMKvObZNtJ6AmdCLP7Lg',
    name: 'Bloomberg Television',
    weight: 0.95,
  },
  yahooFinance: {
    id: 'UCEAZeUIeJs3fZ3ZxqPtOv9A',
    name: 'Yahoo Finance',
    weight: 0.8,
  },
  cnbcMakeIt: {
    id: 'UCX8CLQY5H1gPQOEaUJJMRJg',
    name: 'CNBC Make It',
    weight: 0.7,
  },
  wallStreetJournal: {
    id: 'UCK7tptUDHh-RYDsdxO1-5QQ',
    name: 'Wall Street Journal',
    weight: 0.85,
  },
} as const;

export type ChannelName = keyof typeof FINANCIAL_CHANNELS;

// ===========================================
// Types
// ===========================================

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
}

interface YouTubeSearchResponse {
  items: Array<{
    id: {
      kind: string;
      videoId: string;
    };
    snippet: {
      publishedAt: string;
      channelId: string;
      title: string;
      description: string;
      thumbnails: {
        high: {
          url: string;
        };
      };
      channelTitle: string;
    };
  }>;
}

interface YouTubeVideoDetailsResponse {
  items: Array<{
    id: string;
    statistics: {
      viewCount: string;
      likeCount: string;
      commentCount: string;
    };
  }>;
}

// ===========================================
// API Functions
// ===========================================

/**
 * Search YouTube for videos from a specific channel
 */
async function searchChannelVideos(
  channelId: string,
  query?: string,
  maxResults: number = 10
): Promise<YouTubeVideo[]> {
  if (!YOUTUBE_API_KEY) {
    console.warn('[YouTube] No API key configured. Set YOUTUBE_API_KEY in .env');
    return [];
  }

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      channelId,
      maxResults: maxResults.toString(),
      order: 'date',
      type: 'video',
      key: YOUTUBE_API_KEY,
    });

    if (query) {
      params.append('q', query);
    }

    const response = await fetch(`${YOUTUBE_BASE_URL}/search?${params.toString()}`);

    if (!response.ok) {
      if (response.status === 403) {
        console.error('[YouTube] API quota exceeded or invalid API key');
      }
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data: YouTubeSearchResponse = await response.json();

    // Convert to our format
    const videos: YouTubeVideo[] = data.items.map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      publishedAt: item.snippet.publishedAt,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails.high.url,
    }));

    // Fetch video statistics (views, likes, comments)
    const videoIds = videos.map((v) => v.id).join(',');
    const statsResponse = await fetch(
      `${YOUTUBE_BASE_URL}/videos?part=statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`
    );

    if (statsResponse.ok) {
      const statsData: YouTubeVideoDetailsResponse = await statsResponse.json();

      // Merge statistics into videos
      statsData.items.forEach((item) => {
        const video = videos.find((v) => v.id === item.id);
        if (video) {
          video.viewCount = parseInt(item.statistics.viewCount);
          video.likeCount = parseInt(item.statistics.likeCount);
          video.commentCount = parseInt(item.statistics.commentCount);
        }
      });
    }

    return videos;
  } catch (error) {
    console.error(`[YouTube] Error searching channel ${channelId}:`, error);
    return [];
  }
}

/**
 * Get recent videos from all financial channels
 */
export async function getFinancialVideos(
  query?: string,
  maxPerChannel: number = 5
): Promise<NewsAPIArticle[]> {
  if (!YOUTUBE_API_KEY) {
    console.warn('[YouTube] Skipping - no API key configured');
    return [];
  }

  try {
    console.log('[YouTube] Fetching financial videos...');

    const channels = Object.values(FINANCIAL_CHANNELS);
    const allVideos: YouTubeVideo[] = [];

    // Fetch from each channel
    for (const channel of channels) {
      const videos = await searchChannelVideos(channel.id, query, maxPerChannel);
      allVideos.push(...videos);

      // Small delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(`[YouTube] Found ${allVideos.length} financial videos`);

    // Convert to NewsAPIArticle format
    return allVideos.map((video) => convertVideoToArticle(video));
  } catch (error) {
    console.error('[YouTube] Error fetching financial videos:', error);
    return [];
  }
}

/**
 * Get videos about specific stocks/topics
 */
export async function getStockVideos(
  tickers: string[],
  maxPerTicker: number = 3
): Promise<NewsAPIArticle[]> {
  if (!YOUTUBE_API_KEY) {
    console.warn('[YouTube] Skipping - no API key configured');
    return [];
  }

  try {
    console.log(`[YouTube] Fetching videos for ${tickers.length} tickers...`);

    const allVideos: YouTubeVideo[] = [];

    // Search CNBC and Bloomberg for each ticker
    const topChannels = [FINANCIAL_CHANNELS.cnbc, FINANCIAL_CHANNELS.bloombergTV];

    for (const ticker of tickers) {
      for (const channel of topChannels) {
        const query = `${ticker} stock`;
        const videos = await searchChannelVideos(channel.id, query, maxPerTicker);
        allVideos.push(...videos);

        // Delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    console.log(`[YouTube] Found ${allVideos.length} stock-specific videos`);

    return allVideos.map((video) => convertVideoToArticle(video));
  } catch (error) {
    console.error('[YouTube] Error fetching stock videos:', error);
    return [];
  }
}

/**
 * Get today's market news videos
 */
export async function getTodaysMarketNews(): Promise<NewsAPIArticle[]> {
  if (!YOUTUBE_API_KEY) {
    console.warn('[YouTube] Skipping - no API key configured');
    return [];
  }

  try {
    console.log('[YouTube] Fetching today\'s market news...');

    // Search for market-related content from past 24 hours
    const queries = [
      'stock market today',
      'market news',
      'dow jones',
      'nasdaq',
      'sp500',
    ];

    const allVideos: YouTubeVideo[] = [];

    // Search CNBC and Bloomberg with market queries
    const topChannels = [FINANCIAL_CHANNELS.cnbc, FINANCIAL_CHANNELS.bloombergTV];

    for (const channel of topChannels) {
      for (const query of queries) {
        const videos = await searchChannelVideos(channel.id, query, 3);
        allVideos.push(...videos);

        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // Filter for videos from past 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const recentVideos = allVideos.filter((video) =>
      new Date(video.publishedAt) > oneDayAgo
    );

    console.log(`[YouTube] Found ${recentVideos.length} market news videos from past 24h`);

    return recentVideos.map((video) => convertVideoToArticle(video));
  } catch (error) {
    console.error('[YouTube] Error fetching market news:', error);
    return [];
  }
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * Convert YouTube video to NewsAPIArticle format
 */
function convertVideoToArticle(video: YouTubeVideo): NewsAPIArticle {
  const engagement = video.viewCount
    ? ` (${formatNumber(video.viewCount)} views, ${formatNumber(video.likeCount || 0)} likes)`
    : '';

  return {
    source: {
      id: 'youtube',
      name: video.channelTitle,
    },
    author: video.channelTitle,
    title: video.title,
    description: `${video.description.substring(0, 200)}...${engagement}`,
    url: `https://www.youtube.com/watch?v=${video.id}`,
    urlToImage: video.thumbnailUrl,
    publishedAt: new Date(video.publishedAt).toISOString(),
    content: video.description,
  };
}

/**
 * Format large numbers (1000 -> 1K, 1000000 -> 1M)
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Check if YouTube API is available
 */
export async function isAvailable(): Promise<boolean> {
  if (!YOUTUBE_API_KEY) {
    return false;
  }

  try {
    const response = await fetch(
      `${YOUTUBE_BASE_URL}/search?part=snippet&q=test&maxResults=1&key=${YOUTUBE_API_KEY}`
    );
    return response.ok;
  } catch {
    return false;
  }
}

// Export as namespace
export const youtube = {
  getFinancialVideos,
  getStockVideos,
  getTodaysMarketNews,
  isAvailable,
  FINANCIAL_CHANNELS,
};
