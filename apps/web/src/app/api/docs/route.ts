import { NextResponse } from "next/server"
import { readFile, readdir } from "node:fs/promises"
import { join, basename } from "node:path"

interface DocEntry {
  slug: string
  title: string
  content: string
}

const DOCS_DIR = join(process.cwd(), "..", "..", "docs", "ai")
const README_PATH = join(process.cwd(), "..", "..", "README.md")

/** Extract title from first # heading in markdown */
function extractTitle(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m)
  return match?.[1] ?? fallback
}

/** Convert filename to readable label */
function slugToLabel(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Aaa/g, "AAA")
}

export async function GET() {
  try {
    const docs: DocEntry[] = []

    // Read README as the first doc
    try {
      const readmeContent = await readFile(README_PATH, "utf-8")
      docs.push({
        slug: "readme",
        title: "Overview",
        content: readmeContent,
      })
    } catch {
      // README not found — skip
    }

    // Read all markdown files from docs/ai/
    try {
      const files = await readdir(DOCS_DIR)
      const mdFiles = files.filter((f) => f.endsWith(".md")).sort()

      for (const file of mdFiles) {
        const content = await readFile(join(DOCS_DIR, file), "utf-8")
        const slug = basename(file, ".md")
        docs.push({
          slug,
          title: extractTitle(content, slugToLabel(slug)),
          content,
        })
      }
    } catch {
      // docs/ai directory not found — skip
    }

    return NextResponse.json({ docs })
  } catch {
    return NextResponse.json({ error: "Failed to read documentation" }, { status: 500 })
  }
}
