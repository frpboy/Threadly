"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Render a recovery screen for errors thrown by the root App Router layout.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0E1113] text-[#D7DADC]">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-5 px-6 text-center">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-sm text-[#D7DADC]/75">
            Threadly hit an unexpected error. You can retry without losing your account.
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-[#FF4500]/50 px-5 py-3 font-semibold text-[#FF4500] transition-colors hover:bg-[#FF4500]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
