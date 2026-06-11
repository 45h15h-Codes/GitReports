import { db } from './client';
import { reports, users } from './schema';
import { eq, and } from 'drizzle-orm';

async function main() {
  const username = '45h15h-Codes';
  const period = '2026-05';
  
  const userRow = await db.select().from(users).where(eq(users.username, username)).limit(1).then(r => r[0]);
  if (!userRow) {
    console.log('User not found');
    process.exit(1);
  }
  
  const reportRow = await db.select().from(reports).where(and(eq(reports.userId, userRow.id), eq(reports.period, period))).limit(1).then(r => r[0]);
  if (!reportRow) {
    console.log('Report not found');
    process.exit(1);
  }
  
  console.log(`Report status: ${reportRow.narrativeStatus}`);
  
  if (reportRow.narrativeStatus !== 'complete') {
    console.log('Setting status to complete...');
    await db.update(reports).set({ narrativeStatus: 'complete', narrative: 'This is a test narrative for 2026-05.' }).where(eq(reports.id, reportRow.id));
    console.log('Status updated to complete.');
  }
  
  process.exit(0);
}

main().catch(console.error);
