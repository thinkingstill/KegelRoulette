'use client';

export const runtime = 'edge';

import ClientError from "./client-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ClientError error={error} reset={reset} />;
}
