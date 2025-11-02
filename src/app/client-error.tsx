// app/client-error.tsx
"use client";

export default function ClientError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600 }}>出错了</h2>
      <p style={{ marginTop: 8, color: "#555" }}>
        {error?.message || "发生未知错误"}
      </p>
      <button
        onClick={() => reset()}
        style={{
          marginTop: 12,
          padding: "6px 12px",
          borderRadius: 6,
          background: "#000",
          color: "#fff",
        }}
      >
        重试
      </button>
    </div>
  );
}
