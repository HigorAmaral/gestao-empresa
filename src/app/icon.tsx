import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: "7px",
          color: "#ffffff",
          fontSize: 16,
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        G
      </div>
    ),
    { ...size },
  );
}
