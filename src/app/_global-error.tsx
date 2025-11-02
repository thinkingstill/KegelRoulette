// app/_global-error.tsx
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
