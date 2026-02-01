import { NextRequest, NextResponse } from "next/server";
import { trackActivePredictions } from "@/services/real-time-tracker";
import { db } from "@/lib/db";

/**
 * Cron endpoint: Track active predictions against current prices
 *
 * Schedule: Every 15 minutes during market hours (9:30 AM - 4:00 PM ET)
 * Example: */15 9-16 * * 1-5
 *
 * Usage:
 * GET /api/cron/track-predictions?secret=YOUR_CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const searchParams = request.nextUrl.searchParams;
  const secret = searchParams.get("secret") || authHeader?.replace("Bearer ", "");

  // Verify secret
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Log job start
  const jobRecord = await db.cronJob.create({
    data: {
      jobName: "track-predictions",
      status: "running",
      startedAt: new Date(),
    },
  });

  try {
    console.log("[Cron] Starting prediction tracking...");
    const startTime = Date.now();

    // Track predictions
    const result = await trackActivePredictions();

    const duration = Date.now() - startTime;

    // Update job record
    await db.cronJob.update({
      where: { id: jobRecord.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        duration,
        metadata: {
          predictionsChecked: result.predictionsChecked,
          snapshotsCreated: result.snapshotsCreated,
          errors: result.errors,
        },
      },
    });

    console.log(`[Cron] Prediction tracking completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      duration,
      ...result,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Cron] Prediction tracking failed:", errorMessage);

    // Update job as failed
    await db.cronJob.update({
      where: { id: jobRecord.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        error: errorMessage,
      },
    });

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// Also support POST
export async function POST(request: NextRequest) {
  return GET(request);
}
