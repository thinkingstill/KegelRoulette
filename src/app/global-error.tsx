// app/global-error.tsx
"use client";

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
