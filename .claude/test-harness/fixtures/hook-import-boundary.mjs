/**
 * Fixture: hook-import-boundary
 * Asserts pre-edit-import-boundary blocks cross-app imports,
 * package-to-app imports, and allowed imports pass through.
 */

import {
  runHook,
  permissionDecisionFrom,
  reasonFrom,
} from "../lib/hook-runner.mjs";
import { writePayload } from "../lib/fixture.mjs";
import { expect, combine } from "../lib/assert.mjs";

export const name = "hook-import-boundary";
export const description =
  "pre-edit-import-boundary blocks cross-app + package-to-app; allows package-imports-types";

export async function run() {
  const results = [];

  // Cross-app: apps/web imports from apps/daemon via scoped name path.
  const crossApp = await runHook(
    "pre-edit-import-boundary.mjs",
    writePayload({
      filePath: "apps/web/src/some.ts",
      content: `import { thing } from "../../daemon/src/thing"\n`,
    }),
  );
  results.push(
    expect(permissionDecisionFrom(crossApp.parsed), {
      eq: "deny",
      label: "cross-app decision",
    }),
  );
  results.push(
    expect(reasonFrom(crossApp.parsed), {
      includes: "import-boundary",
      label: "reason cites hook",
    }),
  );

  // Package importing from app is also banned — relative path case.
  const pkgFromApp = await runHook(
    "pre-edit-import-boundary.mjs",
    writePayload({
      filePath: "packages/shared/src/leak.ts",
      content: `import { helper } from "../../../apps/web/src/helper"\n`,
    }),
  );
  results.push(
    expect(permissionDecisionFrom(pkgFromApp.parsed), {
      eq: "deny",
      label: "package-from-app decision",
    }),
  );

  // Allowed: app importing from packages via scoped name.
  const allowed = await runHook(
    "pre-edit-import-boundary.mjs",
    writePayload({
      filePath: "apps/web/src/ok.ts",
      content: `import type { Trade } from "@forexflow/types"\n`,
    }),
  );
  results.push(
    expect(permissionDecisionFrom(allowed.parsed), {
      eq: null,
      label: "types import allowed",
    }),
  );

  return combine(results);
}
