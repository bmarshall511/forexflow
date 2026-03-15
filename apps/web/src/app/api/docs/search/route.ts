import { NextResponse } from "next/server"
import { readFile, readdir } from "node:fs/promises"
import { join, basename } from "node:path"
import { parseFrontmatter } from "@/lib/markdown"

const ROOT = join(process.cwd(), "..", "..")
const USER_DOCS_DIR = join(ROOT, "docs", "user")
const DEV_DOCS_DIR = join(ROOT, "docs", "dev")

interface SearchResult {
  slug: string
  title: string
  category: string
  snippet: string
}

async function readAllDocs(): Promise<
  { slug: string; title: string; category: string; text: string }[]
> {
  const docs: { slug: string; title: string; category: string; text: string }[] = []

  // User docs from subdirectories
  try {
    const entries = await readdir(USER_DOCS_DIR, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith("_")) continue
      const files = await readdir(join(USER_DOCS_DIR, entry.name))
      for (const file of files.filter((f) => f.endsWith(".md"))) {
        const raw = await readFile(join(USER_DOCS_DIR, entry.name, file), "utf-8")
        const { frontmatter, content } = parseFrontmatter(raw)
        const slug = basename(file, ".md").replace(/^\d+-/, "")
        docs.push({
          slug,
          title: frontmatter.title || slug,
          category: frontmatter.category || entry.name,
          text: content,
        })
      }
    }
  } catch {
    // skip
  }

  // Dev docs
  try {
    const files = await readdir(DEV_DOCS_DIR)
    for (const file of files.filter((f) => f.endsWith(".md"))) {
      const raw = await readFile(join(DEV_DOCS_DIR, file), "utf-8")
      const { frontmatter, content } = parseFrontmatter(raw)
      const slug = basename(file, ".md").replace(/^\d+-/, "")
      docs.push({
        slug,
        title: frontmatter.title || slug,
        category: frontmatter.category || "dev",
        text: content,
      })
    }
  } catch {
    // skip
  }

  return docs
}

function extractSnippet(text: string, query: string, contextChars = 80): string {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return text.slice(0, contextChars * 2) + "..."

  const start = Math.max(0, idx - contextChars)
  const end = Math.min(text.length, idx + query.length + contextChars)
  let snippet = text
    .slice(start, end)
    .replace(/\n/g, " ")
    .replace(/#+\s*/g, "")
    .replace(/[*_`]/g, "")

  if (start > 0) snippet = "..." + snippet
  if (end < text.length) snippet = snippet + "..."

  return snippet
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.trim()

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] })
  }

  try {
    const allDocs = await readAllDocs()
    const lowerQuery = query.toLowerCase()

    const results: SearchResult[] = []
    for (const doc of allDocs) {
      const titleMatch = doc.title.toLowerCase().includes(lowerQuery)
      const contentMatch = doc.text.toLowerCase().includes(lowerQuery)

      if (titleMatch || contentMatch) {
        results.push({
          slug: doc.slug,
          title: doc.title,
          category: doc.category,
          snippet: extractSnippet(doc.text, query),
        })
      }
    }

    // Title matches first, then content matches
    results.sort((a, b) => {
      const aTitle = a.title.toLowerCase().includes(lowerQuery) ? 0 : 1
      const bTitle = b.title.toLowerCase().includes(lowerQuery) ? 0 : 1
      return aTitle - bTitle
    })

    return NextResponse.json({ results: results.slice(0, 20) })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
