import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "NutriBalance — Track substance intake for medical and dietary constraints";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #f0f4ff 0%, #e8f5e9 50%, #fff3e0 100%)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "40px 60px",
          maxWidth: "900px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "24px",
            background: "rgba(99, 102, 241, 0.1)",
            borderRadius: "999px",
            padding: "8px 20px",
            fontSize: "18px",
            color: "#4338ca",
            fontWeight: 600,
          }}
        >
          Medical-grade substance tracking
        </div>
        <div
          style={{
            fontSize: "56px",
            fontWeight: 800,
            color: "#1a1a2e",
            textAlign: "center",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            marginBottom: "20px",
          }}
        >
          Can I eat this today?
        </div>
        <div
          style={{
            fontSize: "22px",
            color: "#64748b",
            textAlign: "center",
            lineHeight: 1.5,
            maxWidth: "680px",
          }}
        >
          Track substance intake against your medical limits. Get confidence scores, cooking
          adjustments, and clear answers.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "32px",
            fontSize: "28px",
            fontWeight: 800,
            color: "#4338ca",
            letterSpacing: "-0.01em",
          }}
        >
          NutriBalance
        </div>
      </div>
    </div>,
    { ...size },
  );
}
