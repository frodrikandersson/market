/**
 * Real-Time Prediction Tracker
 *
 * Monitors active predictions every 15 minutes and tracks how
 * accurate they are in real-time by comparing current prices
 * to predicted changes.
 */

import { db } from "@/lib/db";
import { fetchQuote } from "./stock-price";

interface TrackingResult {
  predictionsChecked: number;
  snapshotsCreated: number;
  errors: string[];
}

/**
 * Track all active predictions against current market prices
 * Should be called every 15 minutes during market hours
 */
export async function trackActivePredictions(): Promise<TrackingResult> {
  const result: TrackingResult = {
    predictionsChecked: 0,
    snapshotsCreated: 0,
    errors: [],
  };

  try {
    // Get all predictions that haven't been evaluated yet
    // and target date is today or in the future
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const activePredictions = await db.prediction.findMany({
      where: {
        evaluatedAt: null, // Not yet evaluated
        targetDate: { gte: today }, // Target is today or future
      },
      include: {
        company: {
          select: {
            id: true,
            ticker: true,
          },
        },
      },
    });

    console.log(`[Real-Time Tracker] Found ${activePredictions.length} active predictions`);

    // Process each prediction
    for (const prediction of activePredictions) {
      try {
        result.predictionsChecked++;

        // Get the baseline price (from when prediction was made)
        const baselinePrices = await db.stockPrice.findMany({
          where: {
            companyId: prediction.companyId,
            date: prediction.predictionDate,
          },
          orderBy: { date: "desc" },
          take: 1,
        });

        if (baselinePrices.length === 0) {
          result.errors.push(`No baseline price for ${prediction.company.ticker}`);
          continue;
        }

        const baselinePrice = baselinePrices[0].close;

        // Fetch current price
        const currentPriceData = await fetchQuote(prediction.company.ticker);

        if (!currentPriceData || !currentPriceData.price) {
          result.errors.push(`Could not fetch current price for ${prediction.company.ticker}`);
          continue;
        }

        const currentPrice = currentPriceData.price;

        // Calculate current change
        const priceChange = ((currentPrice - baselinePrice) / baselinePrice) * 100;
        const currentDirection = priceChange > 0.5 ? "up" : priceChange < -0.5 ? "down" : "flat";

        // Calculate deviation from prediction
        const predictedChange = prediction.predictedChange || 0;
        const deviation = Math.abs(priceChange - predictedChange);

        // Check if direction is correct so far
        const isCorrect = currentDirection === prediction.predictedDirection;

        // Create snapshot
        await db.predictionSnapshot.create({
          data: {
            predictionId: prediction.id,
            currentPrice,
            priceChange,
            deviation,
            isCorrect: currentDirection !== "flat" ? isCorrect : null,
          },
        });

        // Update prediction with current status
        await db.prediction.update({
          where: { id: prediction.id },
          data: {
            currentDeviation: deviation,
            lastCheckedAt: now,
          },
        });

        result.snapshotsCreated++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`Error tracking ${prediction.company.ticker}: ${errorMsg}`);
      }
    }

    console.log(`[Real-Time Tracker] Created ${result.snapshotsCreated} snapshots`);

    if (result.errors.length > 0) {
      console.error(`[Real-Time Tracker] Errors:`, result.errors);
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(`Fatal error in trackActivePredictions: ${errorMsg}`);
  }

  return result;
}

/**
 * Get real-time accuracy for a specific prediction
 */
export async function getPredictionProgress(predictionId: string) {
  const snapshots = await db.predictionSnapshot.findMany({
    where: { predictionId },
    orderBy: { checkedAt: "asc" },
  });

  if (snapshots.length === 0) {
    return null;
  }

  const latest = snapshots[snapshots.length - 1];
  const correctCount = snapshots.filter(s => s.isCorrect === true).length;
  const incorrectCount = snapshots.filter(s => s.isCorrect === false).length;

  return {
    snapshots,
    latest: {
      currentPrice: latest.currentPrice,
      priceChange: latest.priceChange,
      deviation: latest.deviation,
      isCorrect: latest.isCorrect,
      checkedAt: latest.checkedAt,
    },
    accuracy: {
      correctChecks: correctCount,
      incorrectChecks: incorrectCount,
      totalChecks: snapshots.length,
      accuracyRate: snapshots.length > 0
        ? (correctCount / (correctCount + incorrectCount)) * 100
        : 0,
    },
  };
}
