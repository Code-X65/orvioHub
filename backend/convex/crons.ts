import { cronJobs } from "convex/server";
import { api } from "./_generated/api.js";

const crons = cronJobs();

// 1. Purge expired deletions daily at 1:00 AM UTC
crons.daily(
  "purge-expired-account-deletions",
  { hourUTC: 1, minuteUTC: 0 },
  api.cronCleanups.purgeExpiredAccountDeletions
);

// 2. Check trial expirations daily at 9:00 AM WAT (8:00 AM UTC)
crons.daily(
  "check-trial-expirations",
  { hourUTC: 8, minuteUTC: 0 },
  api.subscriptions.checkTrialExpirations
);

// 3. Check renewal reminders daily at 9:00 AM WAT (8:00 AM UTC)
crons.daily(
  "check-renewals",
  { hourUTC: 8, minuteUTC: 0 },
  api.subscriptions.checkRenewals
);

// 4. Expire trials hourly
crons.hourly(
  "expire-trials",
  { minuteUTC: 0 },
  api.subscriptions.expireTrials
);

// 5. Process subscription renewals hourly
crons.hourly(
  "process-renewals",
  { minuteUTC: 0 },
  api.subscriptions.processRenewals
);

export default crons;
