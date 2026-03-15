export interface DocEntry {
  slug: string
  title: string
  description: string
  category: string
  order: number
  content: string
}

export interface CategoryGroup {
  id: string
  label: string
  icon: string
  order: number
  docs: DocEntry[]
}

export interface SearchResult {
  slug: string
  title: string
  category: string
  snippet: string
}
