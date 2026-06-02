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
          background: "linear-gradient(135deg, #b28b57, #e7c390)",
          borderRadius: 8,
        }}
      >
        <span style={{ fontSize: 20, fontWeight: 800, color: "#1a1108" }}>T</span>
      </div>
    ),
    { ...size }
  );
}
