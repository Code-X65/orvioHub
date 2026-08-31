import * as Sentry from '@sentry/react';
import { Logtail } from '@logtail/browser';

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
const logtailToken = import.meta.env.VITE_BETTERSTACK_LOGTAIL_TOKEN;

export function initObservability() {
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      integrations: [
        Sentry.browserTracingIntegration(),
      ],
      tracesSampleRate: 1.0,
    });
  }
}

export const logtail = logtailToken ? new Logtail(logtailToken) : null;

export function logError(err: unknown, context?: Record<string, unknown>) {
  if (sentryDsn) {
    Sentry.captureException(err, { extra: context });
  }
  if (logtail) {
    logtail.error(err instanceof Error ? err.message : String(err), context);
  }
}
