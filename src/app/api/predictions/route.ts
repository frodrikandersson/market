/**
 * Predictions API Endpoint
 * ========================
 * Fetches predictions with server-side search and pagination.
 *
 * Query Parameters:
 *   - search: Search by ticker (optional)
 *   - page: Page number (default: 1)
 *   - limit: Items per page (default: 50, max: 100)
 *   - model: Filter by model type ('fundamentals' | 'hype')
 *   - result: Filter by result ('correct' | 'wrong' | 'pending')
 *   - direction: Filter by predicted direction ('up' | 'down')
 *   - minConfidence: Minimum confidence (0-100)
 *   - startDate: Filter predictions made after this date (ISO string)
 *   - endDate: Filter predictions made before this date (ISO string)
 *
 * Usage:
 *   GET /api/predictions?search=TSLA&page=1&limit=50
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);

    // Parse query parameters
    const search = url.searchParams.get('search')?.trim() || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
    const model = url.searchParams.get('model') as 'fundamentals' | 'hype' | null;
    const result = url.searchParams.get('result') as 'correct' | 'wrong' | 'pending' | null;
    const direction = url.searchParams.get('direction') as 'up' | 'down' | null;
    const minConfidence = parseFloat(url.searchParams.get('minConfidence') || '0') / 100;
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // Build where clause
    const where: Prisma.PredictionWhereInput = {};

    // Search by ticker
    if (search) {
      where.company = {
        ticker: {
          contains: search.toUpperCase(),
          mode: 'insensitive',
        },
      };
    }

    // Model filter
    if (model && (model === 'fundamentals' || model === 'hype')) {
      where.modelType = model;
    }

    // Result filter
    if (result) {
      if (result === 'correct') {
        where.wasCorrect = true;
      } else if (result === 'wrong') {
        where.wasCorrect = false;
      } else if (result === 'pending') {
        where.wasCorrect = null;
      }
    }

    // Direction filter
    if (direction && (direction === 'up' || direction === 'down')) {
      where.predictedDirection = direction;
    }

    // Confidence filter
    if (minConfidence > 0) {
      where.confidence = { gte: minConfidence };
    }

    // Date filters (on predictionDate)
    if (startDate || endDate) {
      where.predictionDate = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.predictionDate.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.predictionDate.lte = end;
      }
    }

    // Get total count for pagination
    const totalCount = await db.prediction.count({ where });

    // Get paginated predictions
    const predictions = await db.prediction.findMany({
      where,
      orderBy: { targetDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        company: {
          select: { ticker: true, name: true },
        },
        snapshots: {
          orderBy: { checkedAt: 'desc' },
          take: 1,
        },
      },
    });

    // Map to response format
    const mappedPredictions = predictions.map((p) => {
      const latestSnapshot = p.snapshots[0];
      const currentPrice = latestSnapshot?.currentPrice ?? null;
      const currentChange =
        p.baselinePrice && currentPrice
          ? ((currentPrice - p.baselinePrice) / p.baselinePrice) * 100
          : null;

      return {
        id: p.id,
        ticker: p.company.ticker,
        companyName: p.company.name,
        modelType: p.modelType as 'fundamentals' | 'hype',
        predictedDirection: p.predictedDirection as 'up' | 'down',
        actualDirection: p.actualDirection as 'up' | 'down' | 'flat' | null,
        confidence: p.confidence,
        wasCorrect: p.wasCorrect,
        targetDate: p.targetDate.toISOString(),
        predictionDate: p.predictionDate.toISOString(),
        actualChange: p.actualChange,
        timeframe: p.timeframe,
        targetTime: p.targetTime?.toISOString() ?? null,
        baselinePrice: p.baselinePrice,
        predictedChange: p.predictedChange,
        currentPrice,
        currentChange,
      };
    });

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      predictions: mappedPredictions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('[API] Predictions fetch failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch predictions' },
      { status: 500 }
    );
  }
}
