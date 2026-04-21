/**
 * Minimal assertion helpers for fixtures. Zero-dep.
 *
 * Each helper returns { ok: true } on pass or { ok: false, reason }
 * on fail so fixtures can accumulate findings without throwing.
 */

export function expect(actual, { eq, match, truthy, falsy, includes, label }) {
  if (eq !== undefined) {
    if (actual === eq) return pass();
    return fail(
      `${label || "value"}: expected ${JSON.stringify(eq)}, got ${JSON.stringify(actual)}`,
    );
  }
  if (match !== undefined) {
    if (typeof actual === "string" && match.test(actual)) return pass();
    return fail(
      `${label || "value"}: expected to match ${match}, got ${JSON.stringify(actual)}`,
    );
  }
  if (truthy) {
    if (actual) return pass();
    return fail(
      `${label || "value"}: expected truthy, got ${JSON.stringify(actual)}`,
    );
  }
  if (falsy) {
    if (!actual) return pass();
    return fail(
      `${label || "value"}: expected falsy, got ${JSON.stringify(actual)}`,
    );
  }
  if (includes !== undefined) {
    if (typeof actual === "string" && actual.includes(includes)) return pass();
    return fail(
      `${label || "value"}: expected to include ${JSON.stringify(includes)}, got ${JSON.stringify(actual).slice(0, 200)}`,
    );
  }
  return fail(`${label || "value"}: no assertion supplied`);
}

export function combine(results) {
  const failures = results.filter((r) => !r.ok).map((r) => r.reason);
  if (failures.length === 0) return { passed: true };
  return { passed: false, reason: failures.join("; ") };
}

function pass() {
  return { ok: true };
}

function fail(reason) {
  return { ok: false, reason };
}
