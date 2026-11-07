import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("service worker publication safety", () => {
  const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8")

  it("excludes cross-origin API responses before installing a fetch handler", () => {
    const originGuard = source.indexOf("url.origin !== self.location.origin")
    const responseHandler = source.indexOf("event.respondWith", originGuard)

    expect(originGuard).toBeGreaterThan(-1)
    expect(responseHandler).toBeGreaterThan(originGuard)
  })

  it("only caches successful static resources", () => {
    expect(source).toContain("STATIC_DESTINATIONS.has(event.request.destination)")
    expect(source).toContain("if (response.ok)")
  })
})
