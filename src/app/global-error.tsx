"use client";
import GlobalErrorClient from "@/components/GlobalErrorClient";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <GlobalErrorClient errorMessage={error?.message} reset={reset} />
      </body>
    </html>
  );
}