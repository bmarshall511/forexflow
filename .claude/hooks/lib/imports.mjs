/**
 * Lightweight import-statement parsing.
 *
 * Extracts the string specifier from static `import` and `export`-from
 * statements, plus dynamic `import()` expressions. Good enough for
 * boundary and hallucination checks without a real parser.
 */

const STATIC_IMPORT_RE = /^\s*(?:import|export)\b[^;'"`]*?\bfrom\s+(['"`])([^'"`]+)\1/gm
const BARE_IMPORT_RE = /^\s*import\s+(['"`])([^'"`]+)\1/gm
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g
const REQUIRE_RE = /\brequire\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g

/**
 * Extract every imported specifier from source text.
 * @param {string} source
 * @returns {string[]} - array of specifiers; duplicates preserved
 */
export function extractImports(source) {
  const out = []
  for (const re of [STATIC_IMPORT_RE, BARE_IMPORT_RE, DYNAMIC_IMPORT_RE, REQUIRE_RE]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(source)) !== null) {
      out.push(m[2])
    }
  }
  return out
}

/**
 * True if the specifier is a local (relative or absolute-path) import —
 * i.e., something we can resolve against the repo tree.
 * @param {string} specifier
 */
export function isLocalSpecifier(specifier) {
  return specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("/")
}

/**
 * True if the specifier targets an internal workspace package
 * (anything scoped `@forexflow/*`).
 * @param {string} specifier
 */
export function isWorkspaceSpecifier(specifier) {
  return specifier.startsWith("@forexflow/")
}

/**
 * Split a workspace specifier into its package name and sub-path.
 * E.g., "@forexflow/shared/trading-core" -> { pkg: "@forexflow/shared", subpath: "trading-core" }
 * @param {string} specifier
 */
export function parseWorkspaceSpecifier(specifier) {
  if (!isWorkspaceSpecifier(specifier)) return null
  const rest = specifier.slice("@forexflow/".length)
  const slash = rest.indexOf("/")
  if (slash === -1) return { pkg: "@forexflow/" + rest, subpath: "" }
  return {
    pkg: "@forexflow/" + rest.slice(0, slash),
    subpath: rest.slice(slash + 1),
  }
}

/**
 * Classify the top-level owner of a source-file path.
 * @param {string} relPath - repo-relative forward-slash path
 * @returns {{ kind: "app", name: string } | { kind: "package", name: string } | { kind: "other" }}
 */
export function classifyPath(relPath) {
  const parts = relPath.split("/")
  if (parts[0] === "apps" && parts.length >= 2) return { kind: "app", name: parts[1] }
  if (parts[0] === "packages" && parts.length >= 2) return { kind: "package", name: parts[1] }
  return { kind: "other" }
}
