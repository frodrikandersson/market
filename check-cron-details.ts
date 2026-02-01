import { db } from './src/lib/db';

async function checkCronDetails() {
  try {
    const lastJob = await db.cronJob.findFirst({
      where: { name: 'full-pipeline' },
      orderBy: { startedAt: 'desc' },
    });

    if (!lastJob) {
      console.log('No cron job found');
      return;
    }

    console.log('\n=== LAST FULL PIPELINE RUN ===');
    console.log(`Started: ${lastJob.startedAt.toISOString()}`);
    console.log(`Status: ${lastJob.status}`);
    console.log(`Completed: ${lastJob.completedAt?.toISOString() || 'N/A'}`);
    console.log('\n=== METADATA ===');
    console.log(JSON.stringify(lastJob.metadata, null, 2));

    if (lastJob.error) {
      console.log('\n=== ERROR ===');
      console.log(lastJob.error);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$disconnect();
  }
}

checkCronDetails();
