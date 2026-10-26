import { ImageResponse } from "next/og";
import { NOVA_MARK_SVG } from "@/lib/novaMark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS adds its own rounded mask, so draw the mark edge to edge
export default function AppleIcon() {
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(NOVA_MARK_SVG.replace('rx="15"', 'rx="0"'))}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={180} height={180} alt="" />
      </div>
    ),
    size,
  );
}
