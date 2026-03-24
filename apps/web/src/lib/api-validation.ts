import { z } from "zod"
import { NextResponse } from "next/server"

type ParseSuccess<T> = { success: true; data: T }
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- `any` makes the response assignable to any NextResponse<T> return type
type ParseFailure = { success: false; response: NextResponse<any> }

/**
 * Parse and validate a request body against a Zod schema.
 *
 * On success, returns `{ success: true, data: T }` with the validated + transformed data.
 * On failure, returns `{ success: false, response: NextResponse }` with a 400 JSON error
 * ready to be returned from the route handler.
 */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodSchema<T>,
): Promise<ParseSuccess<T> | ParseFailure> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { ok: false, error: "Invalid JSON in request body" },
        { status: 400 },
      ),
    }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    const fieldErrors = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)"
      return `${path}: ${issue.message}`
    })
    return {
      success: false,
      response: NextResponse.json(
        { ok: false, error: `Validation failed: ${fieldErrors.join("; ")}` },
        { status: 400 },
      ),
    }
  }

  return { success: true, data: result.data }
}

/**
 * Parse and validate URL search params against a Zod schema.
 *
 * Converts the URLSearchParams into a plain object and validates.
 * On failure, returns a 400 JSON error response ready to return from the route handler.
 */
export function parseSearchParams<T>(
  searchParams: URLSearchParams,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- input type differs from output after Zod transforms
  schema: z.ZodType<T, z.ZodTypeDef, any>,
): ParseSuccess<T> | ParseFailure {
  const raw: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    raw[key] = value
  })

  const result = schema.safeParse(raw)
  if (!result.success) {
    const fieldErrors = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)"
      return `${path}: ${issue.message}`
    })
    return {
      success: false,
      response: NextResponse.json(
        { ok: false, error: `Invalid query params: ${fieldErrors.join("; ")}` },
        { status: 400 },
      ),
    }
  }

  return { success: true, data: result.data }
}

/** Create a JSON success response in the standard `{ ok, data }` envelope. */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status })
}

/** Create a JSON error response in the standard `{ ok, error }` envelope. */
export function apiError(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status })
}
