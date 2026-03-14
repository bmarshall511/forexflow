export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      ["web", "daemons", "cf-worker", "mcp-server", "types", "shared", "db", "ci", "docs", "deps"],
    ],
    "scope-empty": [1, "never"],
    "body-max-line-length": [0],
  },
}
