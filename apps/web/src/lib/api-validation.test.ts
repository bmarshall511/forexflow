import { describe, it, expect } from "vitest"
import { z } from "zod"
import { parseBody, apiSuccess, apiError } from "./api-validation"

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a mock Request with a JSON body. */
function mockRequest(body: unknown): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

/** Create a mock Request with an invalid (non-JSON) body. */
function mockInvalidJsonRequest(body: string): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  })
}

const testSchema = z.object({
  name: z.string().min(1, "Name is required"),
  age: z.number().int().min(0, "Age must be non-negative"),
})

// ─── parseBody ───────────────────────────────────────────────────────────────

describe("parseBody", () => {
  it("returns success with validated data for valid input", async () => {
    const request = mockRequest({ name: "Alice", age: 30 })
    const result = await parseBody(request, testSchema)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ name: "Alice", age: 30 })
    }
  })

  it("returns failure with 400 for invalid JSON", async () => {
    const request = mockInvalidJsonRequest("not valid json {{{")
    const result = await parseBody(request, testSchema)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.response.status).toBe(400)
      const body = await result.response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("Invalid JSON in request body")
    }
  })

  it("returns failure with 400 for empty body", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
    })
    const result = await parseBody(request, testSchema)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.response.status).toBe(400)
    }
  })

  it("returns failure with field-level error messages for validation failure", async () => {
    const request = mockRequest({ name: "", age: -5 })
    const result = await parseBody(request, testSchema)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.response.status).toBe(400)
      const body = await result.response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toContain("Validation failed")
      expect(body.error).toContain("name")
      expect(body.error).toContain("Name is required")
      expect(body.error).toContain("age")
      expect(body.error).toContain("Age must be non-negative")
    }
  })

  it("includes field paths in error messages", async () => {
    const nestedSchema = z.object({
      user: z.object({
        email: z.string().email("Invalid email"),
      }),
    })
    const request = mockRequest({ user: { email: "not-an-email" } })
    const result = await parseBody(request, nestedSchema)

    expect(result.success).toBe(false)
    if (!result.success) {
      const body = await result.response.json()
      expect(body.error).toContain("user.email")
      expect(body.error).toContain("Invalid email")
    }
  })

  it("shows (root) for root-level validation errors", async () => {
    const stringSchema = z.string()
    const request = mockRequest(42)
    const result = await parseBody(request, stringSchema)

    expect(result.success).toBe(false)
    if (!result.success) {
      const body = await result.response.json()
      expect(body.error).toContain("(root)")
    }
  })

  it("joins multiple errors with semicolons", async () => {
    const request = mockRequest({})
    const result = await parseBody(request, testSchema)

    expect(result.success).toBe(false)
    if (!result.success) {
      const body = await result.response.json()
      // Missing name and age should produce two errors joined by "; "
      expect(body.error).toContain("; ")
    }
  })

  it("applies schema transformations (e.g. trim)", async () => {
    const trimSchema = z.object({
      value: z.string().trim().min(1),
    })
    const request = mockRequest({ value: "  hello  " })
    const result = await parseBody(request, trimSchema)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.value).toBe("hello")
    }
  })

  it("rejects when strict schema receives extra fields", async () => {
    const strictSchema = z.object({ name: z.string() }).strict()
    const request = mockRequest({ name: "Alice", extra: true })
    const result = await parseBody(request, strictSchema)

    expect(result.success).toBe(false)
    if (!result.success) {
      const body = await result.response.json()
      expect(body.error).toContain("Validation failed")
    }
  })
})

// ─── apiSuccess ──────────────────────────────────────────────────────────────

describe("apiSuccess", () => {
  it("returns 200 with ok:true and data", async () => {
    const response = apiSuccess({ id: 1, name: "Test" })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ ok: true, data: { id: 1, name: "Test" } })
  })

  it("returns custom status code", async () => {
    const response = apiSuccess({ created: true }, 201)

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.data).toEqual({ created: true })
  })

  it("handles null data", async () => {
    const response = apiSuccess(null)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ ok: true, data: null })
  })

  it("handles array data", async () => {
    const response = apiSuccess([1, 2, 3])

    const body = await response.json()
    expect(body.data).toEqual([1, 2, 3])
  })

  it("handles string data", async () => {
    const response = apiSuccess("done")

    const body = await response.json()
    expect(body.data).toBe("done")
  })
})

// ─── apiError ────────────────────────────────────────────────────────────────

describe("apiError", () => {
  it("returns 400 with ok:false and error message", async () => {
    const response = apiError("Something went wrong")

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toEqual({ ok: false, error: "Something went wrong" })
  })

  it("returns custom status code", async () => {
    const response = apiError("Not found", 404)

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body).toEqual({ ok: false, error: "Not found" })
  })

  it("returns 500 for server errors", async () => {
    const response = apiError("Internal server error", 500)

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("Internal server error")
  })

  it("returns 401 for unauthorized", async () => {
    const response = apiError("Unauthorized", 401)

    expect(response.status).toBe(401)
  })

  it("defaults to 400 when status not specified", async () => {
    const response = apiError("Bad request")

    expect(response.status).toBe(400)
  })
})
