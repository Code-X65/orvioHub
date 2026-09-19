import { cronJobs } from "convex/server";
import { api } from "./_generated/api.js";

const crons = cronJobs();

// 1. Purge expired deletions daily at 1:00 AM UTC
crons.daily(
  "purge-expired-account-deletions",
  { hourUTC: 1, minuteUTC: 0 },
  api.cronCleanups.purgeExpiredAccountDeletions,
  {}
);

// 2. Check trial expirations daily at 8:00 AM UTC
crons.daily(
  "check-trial-expirations",
  { hourUTC: 8, minuteUTC: 0 },
  api.subscriptions.checkTrialExpirations,
  {}
);

// 3. Check renewal reminders daily at 8:00 AM UTC
crons.daily(
  "check-renewals",
  { hourUTC: 8, minuteUTC: 0 },
  api.subscriptions.checkRenewals,
  {}
);

// 4. Expire trials hourly
crons.interval(
  "expire-trials",
  { hours: 1 },
  api.subscriptions.expireTrials,
  {}
);

// 5. Process subscription renewals hourly
crons.interval(
  "process-renewals",
  { hours: 1 },
  api.subscriptions.processRenewals,
  {}
);

// 7. Cleanup old read notifications daily at 3:00 AM UTC (30-day retention)
crons.daily(
  "cleanup-old-notifications",
  { hourUTC: 3, minuteUTC: 0 },
  api.notifications.cleanupOldNotifications,
  { olderThanDays: 30 }
);

export default crons;

