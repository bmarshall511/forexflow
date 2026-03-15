/**
 * Lightweight markdown-to-HTML converter for rendering docs in-app.
 * Handles the subset of markdown used in docs/ and README.md.
 * No external dependencies — pure string transforms.
 *
 * Supports:
 * - Standard markdown (headings, lists, tables, code blocks, links, images)
 * - Frontmatter parsing (YAML-like key: value)
 * - Callout blocks: > [!TIP], > [!WARNING], > [!NOTE], > [!IMPORTANT], > [!FOREX]
 * - TOC extraction from headings
 * - Cross-links: [[glossary#term]] syntax
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocFrontmatter {
  title: string
  description: string
  category: string
  order: number
}

export interface DocHeading {
  id: string
  text: string
  level: number
}

export interface ParsedDoc {
  html: string
  headings: DocHeading[]
  frontmatter: DocFrontmatter
}

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Callout types
// ---------------------------------------------------------------------------

const CALLOUT_TYPES: Record<string, { label: string; cls: string }> = {
  TIP: { label: "Tip", cls: "callout-tip" },
  WARNING: { label: "Warning", cls: "callout-warning" },
  NOTE: { label: "Note", cls: "callout-note" },
  IMPORTANT: { label: "Important", cls: "callout-important" },
  FOREX: { label: "Forex Term", cls: "callout-forex" },
}

// ---------------------------------------------------------------------------
// Slugify
// ---------------------------------------------------------------------------

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}

// ---------------------------------------------------------------------------
// Cross-links: [[category#slug]] → <a href="?doc=X#anchor">text</a>
// ---------------------------------------------------------------------------

function processCrossLinks(html: string): string {
  return html.replace(/\[\[([^\]]+)\]\]/g, (_match, ref: string) => {
    const [page, anchor] = ref.split("#")
    const label = anchor
      ? anchor.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
      : (page ?? "").replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
    const href = anchor ? `?doc=${page}#${anchor}` : `?doc=${page}`
    return `<a href="${href}" class="cross-link">${label}</a>`
  })
}

// ---------------------------------------------------------------------------
// Main converter
// ---------------------------------------------------------------------------

/** Legacy wrapper — returns only the HTML string */
export function markdownToHtml(md: string): string {
  return parseMarkdown(md).html
}

/** Full parser — returns HTML, headings for TOC, and frontmatter */
export function parseMarkdown(raw: string): ParsedDoc {
  const { frontmatter, content } = parseFrontmatter(raw)
  const headings: DocHeading[] = []

  // 1. Extract fenced code blocks first — protect from all other transforms
  const codeBlocks: string[] = []
  let html = content.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang: string, code: string) => {
    const escaped = code
      .trimEnd()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
    const cls = lang ? ` class="language-${lang}"` : ""
    codeBlocks.push(`<pre><code${cls}>${escaped}</code></pre>`)
    return `\n%%CB${codeBlocks.length - 1}%%\n`
  })

  // 2. Escape remaining HTML entities
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  // 3. Inline code
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>")

  // 4. Headings — collect for TOC
  html = html.replace(/^(#{1,4}) (.+)$/gm, (_m, hashes: string, t: string) => {
    const level = hashes.length
    const id = slugify(t)
    headings.push({ id, text: t.replace(/<[^>]+>/g, ""), level })
    return `<h${level} id="${id}">${t}</h${level}>`
  })

  // 5. Horizontal rules
  html = html.replace(/^---$/gm, "<hr />")

  // 6. Bold & italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  html = html.replace(/_([^_\s][^_]*[^_\s])_/g, "<em>$1</em>")
  html = html.replace(/(?<!\w)\*([^*\s][^*]*[^*\s])\*(?!\w)/g, "<em>$1</em>")

  // 7. Images: ![alt](src) — BEFORE links so nested image-links work
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')

  // 8. Linked images: [<img ...>](href)
  html = html.replace(
    /\[(<img[^>]+\/>)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="inline-badge">$1</a>',
  )

  // 9. Regular links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  )

  // 10. Callout blockquotes — detect [!TYPE] inside blockquote groups
  html = html.replace(/((?:^&gt; .*\n?)+)/gm, (block) => {
    const inner = block.replace(/^&gt; ?/gm, "").trim()

    // Check for callout syntax: [!TYPE]
    const calloutMatch = inner.match(/^\[!(\w+)\]\s*\n?([\s\S]*)$/)
    if (calloutMatch) {
      const type = calloutMatch[1]?.toUpperCase() ?? ""
      const callout = CALLOUT_TYPES[type]
      if (callout) {
        const body = calloutMatch[2]?.trim() ?? ""
        return `<div class="${callout.cls}" role="note"><span class="callout-label">${callout.label}</span><div class="callout-body">${body}</div></div>`
      }
    }

    return `<blockquote>${inner}</blockquote>`
  })

  // 11. Tables
  html = html.replace(/(\|.+\|\n\|[-| :]+\|\n(?:\|.+\|\n?)+)/g, (table) => {
    const rows = table.trim().split("\n")
    const firstRow = rows[0] ?? ""
    const headers = firstRow
      .split("|")
      .filter(Boolean)
      .map((c) => `<th>${c.trim()}</th>`)
      .join("")
    const body = rows
      .slice(2)
      .map((row) => {
        const cells = row
          .split("|")
          .filter(Boolean)
          .map((c) => `<td>${c.trim()}</td>`)
          .join("")
        return `<tr>${cells}</tr>`
      })
      .join("\n")
    return `<div class="table-wrap"><table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table></div>`
  })

  // 12. Unordered lists — support nested (2-space indent)
  html = html.replace(/((?:^[ ]*- .+\n?)+)/gm, (block) => {
    const items = block
      .trim()
      .split("\n")
      .map((line) => {
        const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0
        const text = line.replace(/^\s*- /, "")
        if (indent >= 2) {
          return `<li class="nested">${text}</li>`
        }
        return `<li>${text}</li>`
      })
      .join("\n")
    return `<ul>${items}</ul>`
  })

  // 13. Ordered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
    const items = block
      .trim()
      .split("\n")
      .map((line) => `<li>${line.replace(/^\d+\. /, "")}</li>`)
      .join("\n")
    return `<ol>${items}</ol>`
  })

  // 14. Cross-links: [[page#anchor]]
  html = processCrossLinks(html)

  // 15. Paragraphs — wrap remaining non-tag, non-empty, non-placeholder lines
  html = html.replace(/^(?!<[a-z/]|%%CB|$)(.+)$/gm, "<p>$1</p>")

  // 16. Clean up mis-wrapped elements
  html = html.replace(/<li><p>(.+?)<\/p><\/li>/g, "<li>$1</li>")

  // 17. Restore code blocks
  html = html.replace(/%%CB(\d+)%%/g, (_m, idx: string) => codeBlocks[Number(idx)] ?? "")

  return { html, headings, frontmatter }
}
