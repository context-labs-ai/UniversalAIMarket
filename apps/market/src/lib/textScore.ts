export function scoreText(haystack: string, needle: string) {
  const query = needle.toLowerCase();
  const tokens = new Set<string>();

  for (const t of query
    .split(/[\s,，。！？!?.；;]+/g)
    .map((v) => v.trim())
    .filter(Boolean)) {
    tokens.add(t);
  }

  const segments = query.match(/[a-z0-9]+|[\u4e00-\u9fff]+/g) ?? [];
  for (const seg of segments) {
    if (/^[\u4e00-\u9fff]+$/.test(seg) && seg.length >= 2) {
      tokens.add(seg);
      for (let i = 0; i < seg.length - 1; i++) {
        tokens.add(seg.slice(i, i + 2));
      }
      continue;
    }
    tokens.add(seg);
  }

  const terms = Array.from(tokens)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => t.length >= 2);
  const content = haystack.toLowerCase();
  return terms.reduce((sum, t) => sum + (content.includes(t) ? 1 : 0), 0);
}

