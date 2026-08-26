/**
 * Frontend Typst ↔ JSON transpiler — mirrors backend typst_transpiler.py
 * For Overleaf editor: JSON is canonical, Typst is Monaco source.
 * Why edit/see matters: user needs to SEE the markup (Overleaf way) for high-stakes
 * resume control — visual form hides ATS-critical whitespace/tables; source shows it.
 * Live WASM would be 50ms; this fallback is <5ms HTML preview for offline.
 */

export function toHtmlPreview(typstSource: string): string {
  // Minimal Typst-like → HTML for instant preview (no server round-trip)
  // Handles: #heading, #text, #list, // provenance, #line, #grid
  let html = typstSource
    // provenance comments → hidden
    .replace(/\/\/\s*provenance:.*$/gm, '')
    // headings
    .replace(
      /#heading\[([^\]]+)\]/g,
      '<h2 style="font-size:11pt;text-transform:uppercase;letter-spacing:1.2pt;border-bottom:0.75pt solid #1a1a1a;padding-bottom:2pt;margin:12pt 0 6pt">$1</h2>',
    )
    .replace(
      /#heading\(level: 2[^)]*\)\[([^\]]+)\]/g,
      '<h2 style="font-size:11pt;font-weight:600;border-bottom:0.75pt solid #1a1a1a;margin:10pt 0 6pt">$1</h2>',
    )
    // text bold
    .replace(/#text\(weight: "bold"\)\[([^\]]+)\]/g, '<b>$1</b>')
    .replace(/#text\(weight: "bold",[^)]*\)\[([^\]]+)\]/g, '<b>$1</b>')
    // links
    .replace(/#link\("([^"]+)"\)\[([^\]]+)\]/g, '<a href="$1" style="color:#2563eb">$2</a>')
    // align/center
    .replace(/#align\(center\)\[/g, '<div style="text-align:center">')
    .replace(/#align\(left\)\[/g, '<div style="text-align:left">')
    // line
    .replace(
      /#line\(length: 100%[^)]*\)/g,
      '<hr style="border:none;border-top:0.75pt solid #1a1a1a;margin:6pt 0"/>',
    )
    .replace(/#v\(.+?\)/g, '<div style="height:6pt"></div>')
    .replace(/#h\(.+?\)/g, ' ')
    .replace(/#page\(.+?\)/g, '')
    .replace(/#set .+/g, '')
    .replace(/#let .+/g, '')
    .replace(/#rect\(.+?\)\[/g, '<div>')
    .replace(/#block\(.+?\)\[/g, '<div style="margin-bottom:6pt">')
    .replace(/#grid\(.+?\)\[/g, '<div style="display:flex;justify-content:space-between">')
    .replace(/#columns\(.+?\)\[/g, '<div>')
    // list
    .replace(/#list\(marker:.*?, indent:.*?\)\[/g, '<ul style="margin-left:14pt;list-style:disc">')
    .replace(/#list\.item\[/g, '<li>')
    .replace(/\]/g, '</div>')
    // cleanup stray
    .replace(/\[|\]/g, '')
    // bullets fallback: lines starting with -
    .split('\n')
    .map((l) => {
      const t = l.trim();
      if (t.startsWith('- ')) return `<li>${(t.slice(2).split('//')[0] ?? '').trim()}</li>`;
      return l;
    })
    .join('\n');

  // Wrap bullets in ul if needed
  if (html.includes('<li>') && !html.includes('<ul')) {
    html = html.replace(/(<li>.*?<\/li>)/gs, '<ul style="margin-left:14pt">$1</ul>');
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page{size:A4;margin:18mm 20mm} *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Garamond, Georgia, serif;color:#1a1a1a;font-size:10.5pt;line-height:1.45;padding:16pt}
    h2{font-size:11pt;text-transform:uppercase;letter-spacing:1.2pt;border-bottom:0.75pt solid #1a1a1a;padding-bottom:2pt;margin-bottom:6pt}
    ul{margin-left:14pt} li{margin-bottom:2pt}
  </style></head><body>${html}</body></html>`;
}

export function extractProvenanceMap(source: string): Map<number, string> {
  const map = new Map<number, string>();
  source.split('\n').forEach((line, idx) => {
    const m = line.match(/provenance:\s*([a-zA-Z0-9_\-]+)/);
    if (m && m[1]) map.set(idx + 1, m[1]);
  });
  return map;
}

export function getSelectedText(source: string, startLine: number, endLine: number): string {
  const lines = source.split('\n');
  return lines.slice(Math.max(0, startLine - 1), Math.min(lines.length, endLine)).join('\n');
}
