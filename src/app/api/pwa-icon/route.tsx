import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export function GET(req: NextRequest) {
  const rawSize = Number(req.nextUrl.searchParams.get("size") ?? "192");
  const size = rawSize === 512 ? 512 : 192;
  const radius = Math.round(size * 0.22);
  const fontSize = Math.round(size * 0.44);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          borderRadius: `${radius}px`,
          border: `${Math.max(4, Math.round(size * 0.03))}px solid #27272a`,
          color: "#ffffff",
          fontSize: `${fontSize}px`,
          fontWeight: 800,
          letterSpacing: "-0.05em",
          fontFamily: "sans-serif",
        }}
      >
        GP
      </div>
    ),
    {
      width: size,
      height: size,
    },
  );
}
