/**
 * Lightweight markdown-to-HTML converter for rendering docs in-app.
 * Handles the subset of markdown used in docs/ai/ and README.md.
 * No external dependencies — pure string transforms.
 */
export function markdownToHtml(md: string): string {
  // 1. Extract fenced code blocks first — protect from all other transforms
  const codeBlocks: string[] = []
  let html = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang: string, code: string) => {
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

  // 4. Headings
  html = html.replace(/^#### (.+)$/gm, (_m, t: string) => `<h4 id="${slugify(t)}">${t}</h4>`)
  html = html.replace(/^### (.+)$/gm, (_m, t: string) => `<h3 id="${slugify(t)}">${t}</h3>`)
  html = html.replace(/^## (.+)$/gm, (_m, t: string) => `<h2 id="${slugify(t)}">${t}</h2>`)
  html = html.replace(/^# (.+)$/gm, (_m, t: string) => `<h1 id="${slugify(t)}">${t}</h1>`)

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

  // 10. Blockquotes — group consecutive > lines
  html = html.replace(/((?:^&gt; .*\n?)+)/gm, (block) => {
    const inner = block.replace(/^&gt; ?/gm, "").trim()
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

  // 12. Unordered lists
  html = html.replace(/((?:^- .+\n?)+)/gm, (block) => {
    const items = block
      .trim()
      .split("\n")
      .map((line) => `<li>${line.replace(/^- /, "")}</li>`)
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

  // 14. Paragraphs — wrap remaining non-tag, non-empty, non-placeholder lines
  html = html.replace(/^(?!<[a-z/]|%%CB|$)(.+)$/gm, "<p>$1</p>")

  // 15. Clean up mis-wrapped elements
  html = html.replace(/<li><p>(.+?)<\/p><\/li>/g, "<li>$1</li>")

  // 16. Restore code blocks
  html = html.replace(/%%CB(\d+)%%/g, (_m, idx: string) => codeBlocks[Number(idx)] ?? "")

  return html
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}
