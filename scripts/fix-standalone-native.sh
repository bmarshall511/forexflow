#!/bin/bash
# Fix native module resolution in Next.js standalone output.
#
# pnpm stores platform-specific native modules (like @libsql/darwin-arm64) in
# their own .pnpm directory, linked into the parent package via symlinks.
# Next.js standalone file tracing copies the files but doesn't recreate the
# pnpm symlinks, so Node.js can't resolve `require('@libsql/darwin-arm64')`
# from within the `libsql` package.
#
# This script copies native modules into the right location for resolution.

set -euo pipefail

STANDALONE="apps/web/.next/standalone"

if [ ! -d "$STANDALONE" ]; then
  echo "[fix-standalone-native] No standalone output found, skipping"
  exit 0
fi

# Find the libsql package's node_modules in the pnpm store
LIBSQL_MODULES=$(find "$STANDALONE/node_modules/.pnpm" -maxdepth 3 -path "*/libsql@*/node_modules" -type d 2>/dev/null | head -1)

if [ -z "$LIBSQL_MODULES" ]; then
  echo "[fix-standalone-native] libsql not found in standalone, skipping"
  exit 0
fi

# Copy each @libsql/darwin-* native module into libsql's node_modules
copied=0
for native_dir in "$STANDALONE"/node_modules/.pnpm/@libsql+darwin-*/node_modules/@libsql/darwin-*; do
  if [ -d "$native_dir" ]; then
    pkg_name=$(basename "$native_dir")
    mkdir -p "$LIBSQL_MODULES/@libsql"
    cp -R "$native_dir" "$LIBSQL_MODULES/@libsql/$pkg_name"
    echo "[fix-standalone-native] Copied @libsql/$pkg_name"
    copied=$((copied + 1))
  fi
done

if [ "$copied" -eq 0 ]; then
  echo "[fix-standalone-native] Warning: no @libsql/darwin-* native modules found"
  exit 1
fi

echo "[fix-standalone-native] Fixed $copied native module(s)"
