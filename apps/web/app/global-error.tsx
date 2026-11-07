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
      <body style={{ margin: 0, minHeight: "100vh", background: "#0E1113", color: "#D7DADC", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ boxSizing: "border-box", minHeight: "100vh", maxWidth: 576, margin: "0 auto", padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 16, lineHeight: 1.5, color: "#BFC3C6", margin: 0 }}>
            Threadly hit an unexpected error. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ borderRadius: 12, border: "1px solid #FF4500", background: "#171A1C", color: "#FF7440", padding: "12px 20px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
