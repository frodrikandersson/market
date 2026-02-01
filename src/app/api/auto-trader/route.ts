/**
 * Auto-Trader API
 * ================
 * Endpoints for the AI auto-trading system with multiple model portfolios.
 *
 * GET  - Get all AI portfolio statuses
 * POST - Trigger auto-trade cycle for all models
 */

import { NextResponse } from 'next/server';
import { autoTrader } from '@/services/auto-trader';

export async function GET() {
  try {
    const status = await autoTrader.getAllStatus();

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AUTO-TRADER API] Error:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    console.log('[AUTO-TRADER API] Manual trigger received');

    const result = await autoTrader.executeFromPredictions();

    return NextResponse.json({
      success: true,
      totalTradesExecuted: result.totalTradesExecuted,
      portfolios: result.portfolios.map(p => ({
        modelType: p.modelType,
        tradesExecuted: p.tradesExecuted,
        buyOrders: p.buyOrders,
        sellOrders: p.sellOrders,
      })),
      errors: result.errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AUTO-TRADER API] Error:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
