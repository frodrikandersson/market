/**
 * Health Check Endpoint
 * =====================
 * Simple health check for Railway deployment.
 * This endpoint does NOT require database connectivity.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
