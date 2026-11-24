// Compact status image issuers and writers can embed. It links back from the HTML snippet, not from inside the SVG.
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function badgeSvg(input: { name: string; symbol: string; line: string }): string {
  const name = esc(input.name).slice(0, 42);
  const symbol = esc(input.symbol).slice(0, 12);
  const line = esc(input.line).slice(0, 72);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="64" viewBox="0 0 320 64" role="img" aria-label="${name} on ReserveWatch">
  <rect width="320" height="64" rx="10" fill="#0B1F33"/>
  <rect x="0" y="0" width="4" height="64" fill="#94801C"/>
  <text x="16" y="24" fill="#C4B483" font-family="Georgia, serif" font-size="11" letter-spacing="1.5">RESERVEWATCH</text>
  <text x="16" y="44" fill="#F3F0E8" font-family="Georgia, serif" font-size="16">${name} · ${symbol}</text>
  <text x="16" y="58" fill="#D5D0C6" font-family="Georgia, sans-serif" font-size="11">${line}</text>
</svg>
`;
}

export function badgeEmbed(opts: { pageUrl: string; imageUrl: string; name: string; symbol: string }): string {
  const alreadyNamed = opts.name.includes(`(${opts.symbol})`);
  const alt = alreadyNamed ? `${opts.name} on ReserveWatch` : `${opts.name} (${opts.symbol}) on ReserveWatch`;
  return `<a href="${opts.pageUrl}"><img src="${opts.imageUrl}" alt="${alt}" width="320" height="64"></a>`;
}
