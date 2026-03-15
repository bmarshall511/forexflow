/**
 * Shared markdown utilities for parsing frontmatter.
 * Used by both the web app (in-app docs) and the static docs site generator.
 * No external dependencies — pure string transforms.
 */

export interface DocFrontmatter {
  title: string
  description: string
  category: string
  order: number
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/

export function parseFrontmatter(raw: string): { frontmatter: DocFrontmatter; content: string } {
  const match = raw.match(FRONTMATTER_RE)
  if (!match) {
    return {
      frontmatter: { title: "", description: "", category: "", order: 0 },
      content: raw,
    }
  }

  const block = match[1] ?? ""
  const content = raw.slice(match[0].length)
  const fm: Record<string, string> = {}

  for (const line of block.split("\n")) {
    const idx = line.indexOf(":")
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const val = line
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, "")
    fm[key] = val
  }

  return {
    frontmatter: {
      title: fm["title"] ?? "",
      description: fm["description"] ?? "",
      category: fm["category"] ?? "",
      order: Number(fm["order"]) || 0,
    },
    content,
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}
