// A hand-rolled shields.io-style flat badge - no external service call
// and no image library, just an SVG string. Real width per label/message
// isn't computed from actual font metrics (that needs a real font
// rasterizer, overkill for a two-color status pill embedded in a
// README), but a fixed per-character estimate tuned for the specific
// font/size used here renders close enough that nothing clips or leaves
// obviously excess padding - the same tradeoff most lightweight badge
// generators make.
const CHAR_WIDTH_PX = 6.5;
const SIDE_PADDING_PX = 10;
const HEIGHT_PX = 20;

function textWidth(text: string): number {
  return Math.round(text.length * CHAR_WIDTH_PX + SIDE_PADDING_PX * 2);
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderBadgeSvg(label: string, message: string, color: string): string {
  const labelWidth = textWidth(label);
  const messageWidth = textWidth(message);
  const totalWidth = labelWidth + messageWidth;
  const labelX = labelWidth / 2;
  const messageX = labelWidth + messageWidth / 2;
  const safeLabel = escapeXml(label);
  const safeMessage = escapeXml(message);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${HEIGHT_PX}" role="img" aria-label="${safeLabel}: ${safeMessage}">
  <title>${safeLabel}: ${safeMessage}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="${HEIGHT_PX}" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="${HEIGHT_PX}" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="${HEIGHT_PX}" fill="${color}"/>
    <rect width="${totalWidth}" height="${HEIGHT_PX}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelX}" y="14">${safeLabel}</text>
    <text x="${messageX}" y="14">${safeMessage}</text>
  </g>
</svg>`;
}
