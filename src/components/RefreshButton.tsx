'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface RefreshResult {
  success: boolean;
  results?: {
    news: { articles: number; saved: number };
    social: { posts: number; saved: number };
    errors: string[];
  };
  durationMs?: number;
  message?: string;
  error?: string;
}

export function RefreshButton() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastResult, setLastResult] = useState<RefreshResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleRefresh = async () => {
    // Prompt for admin password
    const password = prompt('Enter admin password to refresh data:');
    if (!password) {
      return; // User cancelled
    }

    setIsRefreshing(true);
    setShowResult(false);

    try {
      const response = await fetch('/api/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${password}`,
        },
      });

      const result: RefreshResult = await response.json();
      setLastResult(result);
      setShowResult(true);

      // Hide result after 5 seconds
      setTimeout(() => setShowResult(false), 5000);

      // Reload the page to show new data
      if (result.success) {
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (error) {
      setLastResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh',
      });
      setShowResult(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
          transition-all duration-200
          ${isRefreshing
            ? 'bg-primary/20 text-primary cursor-wait'
            : 'bg-surface border border-border hover:border-primary/50 hover:bg-primary/10 text-text-secondary hover:text-primary'
          }
        `}
      >
        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
      </button>

      {/* Result popup */}
      {showResult && lastResult && (
        <div
          className={`
            absolute top-full right-0 mt-2 p-3 rounded-lg shadow-lg z-50 min-w-[200px]
            ${lastResult.success
              ? 'bg-positive/10 border border-positive/30'
              : 'bg-negative/10 border border-negative/30'
            }
          `}
        >
          {lastResult.success && lastResult.results ? (
            <div className="text-xs space-y-1">
              <div className="font-semibold text-positive mb-2">Data Fetched!</div>
              <div className="text-text-secondary">
                News: {lastResult.results.news.saved} saved
              </div>
              <div className="text-text-secondary">
                Social: {lastResult.results.social.saved} saved
              </div>
              <div className="text-text-muted mt-2 text-[10px]">
                AI processing happens in background
              </div>
              <div className="text-text-muted mt-1">
                Reloading page...
              </div>
            </div>
          ) : (
            <div className="text-xs text-negative">
              Error: {lastResult.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
