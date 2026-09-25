import { ConvexHttpClient } from 'convex/browser';
import dotenv from 'dotenv';
import { anyApi } from 'convex/server';

dotenv.config({ path: '.env.local' });
dotenv.config();

const convexUrl = process.env.CONVEX_URL || 'https://ceaseless-bloodhound-791.convex.cloud';
const client = new ConvexHttpClient(convexUrl);

async function main() {
  console.log('====================================================');
  console.log('ORVIOHUB CLEAN SLATE DATABASE PURGE');
  console.log(`Target Convex URL: ${convexUrl}`);
  console.log('====================================================\n');

  try {
    let iteration = 1;
    let totalDeleted = 0;
    const aggregatedCounts: Record<string, number> = {};

    while (true) {
      process.stdout.write(`Executing batch iteration ${iteration}... `);
      const res: any = await client.mutation(
        (anyApi as any).cronCleanups.purgeCleanSlateBatch,
        {
          confirmText: 'YES_PURGE_TEST_DATA',
          batchLimit: 400,
        }
      );

      totalDeleted += res.batchDeletedCount;

      for (const [table, count] of Object.entries(res.deletedSummary || {})) {
        aggregatedCounts[table] = (aggregatedCounts[table] || 0) + (count as number);
      }

      console.log(`Deleted ${res.batchDeletedCount} records.`);

      if (!res.hasMore || res.batchDeletedCount === 0) {
        break;
      }

      iteration++;
      if (iteration > 100) {
        console.warn('Max iteration safety limit reached.');
        break;
      }
    }

    console.log('\n====================================================');
    console.log('PURGE COMPLETE');
    console.log(`Total records deleted across ${iteration} batches: ${totalDeleted}`);
    console.log('====================================================\n');

    console.log('--- Deleted Records Summary by Table ---');
    console.table(aggregatedCounts);

    // Fetch and display final verification status
    const status: any = await client.mutation(
      (anyApi as any).cronCleanups.getCleanSlateStatus,
      {}
    );

    console.log('\n--- Preserved Master & System Records ---');
    console.table(status.preservedTables);

    console.log('\nDatabase is now 100% clean and ready for fresh operational use.\n');
    process.exit(0);
  } catch (error: any) {
    console.error('\n[ERROR] Failed to execute database purge:', error.message || error);
    process.exit(1);
  }
}

main();
