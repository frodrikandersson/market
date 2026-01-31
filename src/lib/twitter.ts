/**
 * Twitter/X API Client
 * ====================
 * Client for fetching tweets from influential accounts.
 * Used for the Hype Model predictions.
 *
 * API Documentation: https://developer.x.com/en/docs/twitter-api
 * Rate Limits: Varies by tier (Basic: 10K reads/month)
 *
 * Usage:
 *   import { twitter } from '@/lib/twitter';
 *   const tweets = await twitter.getUserTweets('elonmusk');
 */

import type { XTweet, XTweetsResponse } from '@/types';

const TWITTER_BASE_URL = 'https://api.x.com/2';

/**
 * Get Twitter Bearer Token from environment
 */
function getBearerToken(): string {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) {
    throw new Error('TWITTER_BEARER_TOKEN environment variable is not set');
  }
  return token;
}

/**
 * Make a request to Twitter API
 */
async function fetchTwitter<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${TWITTER_BASE_URL}${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${getBearerToken()}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Twitter API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Get user ID from username
 */
export async function getUserId(username: string): Promise<string | null> {
  try {
    const cleanUsername = username.replace('@', '');
    const response = await fetchTwitter<{ data: { id: string; name: string; username: string } }>(
      `/users/by/username/${cleanUsername}`
    );
    return response.data?.id || null;
  } catch (error) {
    console.error(`[Twitter] Failed to get user ID for ${username}:`, error);
    return null;
  }
}

/**
 * Get recent tweets from a user
 */
export async function getUserTweets(
  userId: string,
  options: {
    maxResults?: number;
    startTime?: string; // ISO 8601
    endTime?: string;
  } = {}
): Promise<XTweet[]> {
  try {
    const params: Record<string, string> = {
      'max_results': (options.maxResults || 10).toString(),
      'tweet.fields': 'created_at,public_metrics,entities',
    };

    if (options.startTime) params['start_time'] = options.startTime;
    if (options.endTime) params['end_time'] = options.endTime;

    const response = await fetchTwitter<XTweetsResponse>(
      `/users/${userId}/tweets`,
      params
    );

    return response.data || [];
  } catch (error) {
    console.error(`[Twitter] Failed to get tweets for user ${userId}:`, error);
    return [];
  }
}

/**
 * Get tweets by username (combines lookup + tweets)
 */
export async function getTweetsByUsername(
  username: string,
  maxResults: number = 10
): Promise<XTweet[]> {
  const userId = await getUserId(username);
  if (!userId) {
    return [];
  }

  return getUserTweets(userId, { maxResults });
}

/**
 * Search for recent tweets mentioning a company
 */
export async function searchTweets(
  query: string,
  options: {
    maxResults?: number;
    startTime?: string;
  } = {}
): Promise<XTweet[]> {
  try {
    const params: Record<string, string> = {
      query,
      'max_results': (options.maxResults || 10).toString(),
      'tweet.fields': 'created_at,public_metrics,entities,author_id',
    };

    if (options.startTime) params['start_time'] = options.startTime;

    const response = await fetchTwitter<XTweetsResponse>('/tweets/search/recent', params);
    return response.data || [];
  } catch (error) {
    console.error(`[Twitter] Search failed for "${query}":`, error);
    return [];
  }
}

/**
 * Extract cashtags from tweet
 */
export function extractCashtags(tweet: XTweet): string[] {
  if (!tweet.entities?.cashtags) {
    return [];
  }
  return tweet.entities.cashtags.map((c) => c.tag.toUpperCase());
}

/**
 * Calculate engagement score
 */
export function calculateEngagement(tweet: XTweet): number {
  const metrics = tweet.public_metrics;
  if (!metrics) return 0;

  // Weighted engagement score
  return (
    metrics.like_count * 1 +
    metrics.retweet_count * 2 +
    metrics.reply_count * 1.5 +
    metrics.quote_count * 2
  );
}

/**
 * Check if Twitter API is configured
 */
export function isConfigured(): boolean {
  return !!process.env.TWITTER_BEARER_TOKEN;
}

// Export as namespace
export const twitter = {
  getUserId,
  getUserTweets,
  getTweetsByUsername,
  searchTweets,
  extractCashtags,
  calculateEngagement,
  isConfigured,
};
