// Minimal YAML-frontmatter reader shared by structural fixtures.
// Matches the subset of YAML the .claude/ config actually uses.

export function parseFrontmatter(src) {
  if (!src.startsWith("---\n")) return null;
  const end = src.indexOf("\n---", 4);
  if (end === -1) return null;
  const raw = src.slice(4, end);
  const out = {};
  let list = null;
  for (const line of raw.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const arr = line.match(/^\s+-\s+(.*)$/);
    if (arr && list) {
      list.push(stripQ(arr[1]));
      continue;
    }
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (v === "" || v === "|") {
      list = [];
      out[k] = list;
      continue;
    }
    if (v.startsWith("[") && v.endsWith("]")) {
      out[k] = v
        .slice(1, -1)
        .split(",")
        .map((s) => stripQ(s.trim()))
        .filter(Boolean);
      list = null;
      continue;
    }
    out[k] = stripQ(v);
    list = null;
  }
  return out;
}

function stripQ(s) {
  if (!s) return "";
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}
