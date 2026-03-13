---
name: stale-rules
description: Detect stale AI coding rules that reference non-existent files or patterns.
disable-model-invocation: true
---

# Stale Rule Detection

Scan all AI coding rules and skills for references to files, paths, or patterns that no longer exist.

## Steps

1. **Collect all rule files:**
   - `.claude/CLAUDE.md` and `.claude/rules/*.md`
   - `.cursor/rules/*.mdc`
   - `.agents/skills/*/SKILL.md`
   - `docs/ai/*.md`
   - Subdirectory `CLAUDE.md` files

2. **Extract file path references:**
   - Paths in code blocks
   - @import references
   - Glob patterns in frontmatter
   - Directory references in text

3. **Verify each reference exists:**
   - Check file/directory exists on disk
   - Check glob patterns match at least one file
   - Check referenced functions/types still exist in source

4. **Report:**
   - List of stale references with file:line
   - Suggested fixes (update path, remove reference, etc.)
   - Rules that may be entirely obsolete
