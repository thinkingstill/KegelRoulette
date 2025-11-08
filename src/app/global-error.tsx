// app/global-error.tsx
"use client";
export const runtime = "edge";

import ClientError from "./client-error";

export default function GlobalError(props: any) {
  return (
    <html>
      <body>
        <ClientError {...props} />
      </body>
    </html>
  );
}
