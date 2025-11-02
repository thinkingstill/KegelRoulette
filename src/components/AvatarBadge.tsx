"use client";
import { useEffect, useState } from "react";
import { avatarDataUri } from "@/lib/avatars";

export default function AvatarBadge({ seed, count, name }: { seed: string; count: number; name: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    avatarDataUri(seed).then(setSrc);
  }, [seed]);
  return (
    <div className="relative inline-flex items-center">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-16 w-16 rounded-xl shadow-md" />
      ) : (
        <div className="h-16 w-16 rounded-xl bg-gray-200 animate-pulse" />
      )}
      <span className="absolute -bottom-2 -right-2 text-xs px-2 py-1 rounded-full bg-black text-white shadow">
        {count}
      </span>
    </div>
  );
}