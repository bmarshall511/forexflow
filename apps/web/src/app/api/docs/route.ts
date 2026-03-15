import { NextResponse } from "next/server"
import { readFile, readdir } from "node:fs/promises"
import { join, basename } from "node:path"
import { parseFrontmatter } from "@/lib/markdown"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocEntry {
  slug: string
  title: string
  description: string
  category: string
  order: number
  content: string
}

interface CategoryMeta {
  id: string
  label: string
  icon: string
  order: number
}

interface CategoryGroup {
  id: string
  label: string
  icon: string
  order: number
  docs: DocEntry[]
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = join(process.cwd(), "..", "..")
const USER_DOCS_DIR = join(ROOT, "docs", "user")
const DEV_DOCS_DIR = join(ROOT, "docs", "dev")

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractTitle(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m)
  return match?.[1] ?? fallback
}

async function readMdFiles(dir: string): Promise<{ filename: string; raw: string }[]> {
  try {
    const files = await readdir(dir)
    const mdFiles = files.filter((f) => f.endsWith(".md")).sort()
    const results: { filename: string; raw: string }[] = []
    for (const file of mdFiles) {
      const raw = await readFile(join(dir, file), "utf-8")
      results.push({ filename: file, raw })
    }
    return results
  } catch {
    return []
  }
}

async function readCategoryDirs(
  parentDir: string,
): Promise<{ filename: string; raw: string; subdir: string }[]> {
  try {
    const entries = await readdir(parentDir, { withFileTypes: true })
    const results: { filename: string; raw: string; subdir: string }[] = []
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith("_")) continue
      const subFiles = await readMdFiles(join(parentDir, entry.name))
      for (const sf of subFiles) {
        results.push({ ...sf, subdir: entry.name })
      }
    }
    return results
  } catch {
    return []
  }
}

function slugToLabel(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function parseDocFile(filename: string, raw: string, categoryFallback: string): DocEntry {
  const { frontmatter, content } = parseFrontmatter(raw)
  const slug = basename(filename, ".md").replace(/^\d+-/, "")
  return {
    slug,
    title: frontmatter.title || extractTitle(content, slugToLabel(slug)),
    description: frontmatter.description || "",
    category: frontmatter.category || categoryFallback,
    order: frontmatter.order || 0,
    content: raw,
  }
}

async function readMeta(dir: string): Promise<CategoryMeta[]> {
  try {
    const raw = await readFile(join(dir, "_meta.json"), "utf-8")
    const data = JSON.parse(raw)
    return data.categories ?? []
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// GET /api/docs
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const userMeta = await readMeta(USER_DOCS_DIR)
    const devMeta = await readMeta(DEV_DOCS_DIR)
    const allMeta = [...userMeta, ...devMeta]

    const userFiles = await readCategoryDirs(USER_DOCS_DIR)
    const userDocs = userFiles.map((f) => parseDocFile(f.filename, f.raw, f.subdir))

    const devFiles = await readMdFiles(DEV_DOCS_DIR)
    const devDocs = devFiles
      .filter((f) => f.filename.endsWith(".md"))
      .map((f) => parseDocFile(f.filename, f.raw, "dev"))

    const allDocs = [...userDocs, ...devDocs]

    const categoryMap = new Map<string, CategoryGroup>()
    for (const meta of allMeta) {
      categoryMap.set(meta.id, { ...meta, docs: [] })
    }
    for (const doc of allDocs) {
      let group = categoryMap.get(doc.category)
      if (!group) {
        group = {
          id: doc.category,
          label: slugToLabel(doc.category),
          icon: "FileText",
          order: 99,
          docs: [],
        }
        categoryMap.set(doc.category, group)
      }
      group.docs.push(doc)
    }

    const categories = Array.from(categoryMap.values())
      .filter((c) => c.docs.length > 0)
      .sort((a, b) => a.order - b.order)
      .map((c) => ({ ...c, docs: c.docs.sort((a, b) => a.order - b.order) }))

    return NextResponse.json({ categories })
  } catch {
    return NextResponse.json({ error: "Failed to read documentation" }, { status: 500 })
  }
}
