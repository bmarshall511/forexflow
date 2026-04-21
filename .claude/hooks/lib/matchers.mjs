/**
 * Path and glob matching helpers.
 * Zero dependencies — Node built-ins only.
 */

import fs from "node:fs"
import path from "node:path"

/**
 * Normalize a path relative to the repo root.
 * Handles absolute paths, ./ prefixes, and backslashes.
 * @param {string} p
 * @param {string} repoRoot
 * @returns {string} - forward-slash relative path
 */
export function toRelative(p, repoRoot) {
  if (!p) return ""
  const abs = path.isAbsolute(p) ? p : path.resolve(repoRoot, p)
  return path.relative(repoRoot, abs).split(path.sep).join("/")
}

/**
 * Convert a glob pattern to a RegExp.
 * Supports: **, *, ?, character classes, and brace expansion {a,b,c}.
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegex(glob) {
  // Expand braces first: {a,b,c} -> (a|b|c)
  const braceExpanded = glob.replace(/\{([^{}]*)\}/g, (_, inner) => `(${inner.split(",").join("|")})`)

  let re = "^"
  let i = 0
  while (i < braceExpanded.length) {
    const c = braceExpanded[i]
    if (c === "*" && braceExpanded[i + 1] === "*") {
      // **/ matches zero or more directory segments
      if (braceExpanded[i + 2] === "/") {
        re += "(?:.*/)?"
        i += 3
      } else {
        re += ".*"
        i += 2
      }
    } else if (c === "*") {
      re += "[^/]*"
      i += 1
    } else if (c === "?") {
      re += "[^/]"
      i += 1
    } else if ("().+^$|\\".includes(c)) {
      re += "\\" + c
      i += 1
    } else {
      re += c
      i += 1
    }
  }
  re += "$"
  return new RegExp(re)
}

/**
 * Test whether a path matches any glob in the list.
 * @param {string} filePath - forward-slash relative path
 * @param {readonly string[]} globs
 */
export function matchesAny(filePath, globs) {
  return globs.some((g) => globToRegex(g).test(filePath))
}

/**
 * Find the closest ancestor directory containing a given marker file.
 * @param {string} startDir
 * @param {string} marker - filename to look for (e.g. "package.json")
 * @returns {string | null}
 */
export function findAncestor(startDir, marker) {
  let dir = path.resolve(startDir)
  while (true) {
    if (existsSafe(path.join(dir, marker))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function existsSafe(p) {
  try {
    fs.accessSync(p)
    return true
  } catch {
    return false
  }
}
