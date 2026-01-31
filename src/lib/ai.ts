/**
 * Unified AI Client
 * =================
 * A provider-agnostic AI client that can switch between Gemini and Claude.
 * Currently defaults to Gemini for testing (free tier).
 *
 * Usage:
 *   import { ai } from '@/lib/ai';
 *   const analysis = await ai.analyzeNewsArticle(title, content);
 *
 * To switch providers, set AI_PROVIDER env variable:
 *   AI_PROVIDER=gemini (default)
 *   AI_PROVIDER=claude
 */

import { gemini } from './gemini';
import { claude } from './claude';
import type {
  ClaudeNewsAnalysis,
  ClaudeSocialAnalysis,
  Sentiment,
  EventCategory,
} from '@/types';

// Determine which AI provider to use
// Default to Gemini for testing (free tier)
type AIProvider = 'gemini' | 'claude';

function getProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  if (provider === 'claude') return 'claude';
  return 'gemini'; // Default
}

/**
 * Get the active AI client based on configuration
 */
function getClient() {
  const provider = getProvider();
  return provider === 'claude' ? claude : gemini;
}

/**
 * Analyze a news article for stock market impact
 */
export async function analyzeNewsArticle(
  title: string,
  content: string
): Promise<ClaudeNewsAnalysis> {
  return getClient().analyzeNewsArticle(title, content);
}

/**
 * Analyze a social media post for stock mentions and sentiment
 */
export async function analyzeSocialPost(
  content: string,
  authorName: string
): Promise<ClaudeSocialAnalysis> {
  return getClient().analyzeSocialPost(content, authorName);
}

/**
 * Batch analyze multiple articles
 */
export async function analyzeArticlesBatch(
  articles: Array<{ title: string; content: string }>
): Promise<ClaudeNewsAnalysis[]> {
  return getClient().analyzeArticlesBatch(articles);
}

/**
 * Summarize multiple articles into a single event summary
 */
export async function summarizeEvent(
  articles: Array<{ title: string; summary?: string }>
): Promise<{
  summary: string;
  category: EventCategory;
  importance: number;
}> {
  return getClient().summarizeEvent(articles);
}

/**
 * Extract company tickers from text
 */
export async function extractTickers(text: string): Promise<string[]> {
  return getClient().extractTickers(text);
}

/**
 * Determine overall sentiment from multiple sentiment values
 */
export function aggregateSentiment(
  sentiments: Array<{ sentiment: Sentiment; confidence: number }>
): { sentiment: Sentiment; confidence: number } {
  return getClient().aggregateSentiment(sentiments);
}

/**
 * Get the current AI provider name
 */
export function getCurrentProvider(): AIProvider {
  return getProvider();
}

// Export as namespace for cleaner imports
export const ai = {
  analyzeNewsArticle,
  analyzeSocialPost,
  analyzeArticlesBatch,
  summarizeEvent,
  extractTickers,
  aggregateSentiment,
  getCurrentProvider,
};
