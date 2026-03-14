import { danger, fail, warn, message } from "danger"

const pr = danger.github.pr
const modifiedFiles = danger.git.modified_files
const createdFiles = danger.git.created_files
const allChangedFiles = [...modifiedFiles, ...createdFiles]

// --- PR Quality ---

// Warn on large PRs
const diffSize = (pr.additions ?? 0) + (pr.deletions ?? 0)
if (diffSize > 500) {
  warn(
    `This PR has ${diffSize} lines of changes. Consider splitting it into smaller PRs for easier review.`,
  )
}

// Require PR description
if (!pr.body || pr.body.trim().length < 50) {
  fail("Please provide a meaningful PR description (at least 50 characters).")
}

// --- Lockfile consistency ---
const packageJsonChanged = allChangedFiles.some((f) => f.includes("package.json"))
const lockfileChanged = allChangedFiles.includes("pnpm-lock.yaml")

if (packageJsonChanged && !lockfileChanged) {
  warn(
    "A `package.json` was changed but `pnpm-lock.yaml` was not updated. Did you forget to run `pnpm install`?",
  )
}

// --- Import boundary check ---
const packageFiles = allChangedFiles.filter((f) => f.startsWith("packages/"))
for (const file of packageFiles) {
  if (file.endsWith(".ts") || file.endsWith(".tsx")) {
    // This is a basic check — Danger reads file content via GitHub API
    // A more thorough check would use AST parsing
    const content = danger.git.diffForFile(file)
    if (content) {
      content.then((diff) => {
        if (diff?.added?.match(/from ["'](?:\.\.\/)*apps\//)) {
          fail(`\`${file}\` imports from \`apps/\` — packages must not import from apps.`)
        }
      })
    }
  }
}

// --- Missing test files ---
const newSourceFiles = createdFiles.filter(
  (f) =>
    f.startsWith("packages/") &&
    f.endsWith(".ts") &&
    !f.endsWith(".test.ts") &&
    !f.endsWith(".d.ts") &&
    !f.includes("/index.ts") &&
    !f.includes("/generated/"),
)

for (const file of newSourceFiles) {
  const testFile = file.replace(".ts", ".test.ts")
  if (!createdFiles.includes(testFile)) {
    warn(`New file \`${file}\` has no corresponding test file (\`${testFile}\`).`)
  }
}

// --- Changelog reminder ---
const isFeatureOrFix = allChangedFiles.some(
  (f) =>
    (f.startsWith("apps/") || f.startsWith("packages/")) &&
    (f.endsWith(".ts") || f.endsWith(".tsx")) &&
    !f.includes("eslint") &&
    !f.includes(".test."),
)
const changelogUpdated = allChangedFiles.includes("CHANGELOG.md")

if (isFeatureOrFix && !changelogUpdated) {
  message("Consider updating `CHANGELOG.md` if this includes user-facing changes.")
}
