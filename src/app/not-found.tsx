"use client";
export const runtime = "edge";

export default function NotFound() {
  return (
    <div style={{ padding: 24 }}>
      <h2>页面不存在</h2>
      <p>请检查链接或从首页重新进入房间。</p>
      <a href="/" style={{ color: "#2563eb" }}>返回首页</a>
    </div>
  );
}