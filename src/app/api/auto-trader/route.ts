/**
 * Auto-Trader API
 * ================
 * Endpoints for the AI auto-trading system.
 *
 * GET  - Get AI portfolio status
 * POST - Trigger auto-trade cycle
 */

import { NextResponse } from 'next/server';
import { autoTrader } from '@/services/auto-trader';

export async function GET() {
  try {
    const status = await autoTrader.getStatus();

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
      ...result,
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
