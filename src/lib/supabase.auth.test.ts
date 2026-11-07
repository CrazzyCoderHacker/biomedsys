import type { SupabaseClient } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"
import { loadActiveProfile, type Profile } from "./supabase"

function profileClient(result: { data: Profile | null; error: Error | null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eqActive = vi.fn().mockReturnValue({ maybeSingle })
  const eqId = vi.fn().mockReturnValue({ eq: eqActive })
  const select = vi.fn().mockReturnValue({ eq: eqId })
  const from = vi.fn().mockReturnValue({ select })
  return {
    client: { from } as unknown as SupabaseClient,
    from,
    select,
    eqId,
    eqActive,
  }
}

const activeProfile: Profile = {
  id: "11111111-1111-1111-1111-111111111111",
  institutional_id: "01100001",
  full_name: "Técnico activo",
  role: "tecnico",
  department: "Ingeniería Clínica",
  active: true,
}

describe("perfiles activos", () => {
  it("carga únicamente el perfil activo de la sesión", async () => {
    const mock = profileClient({ data: activeProfile, error: null })

    await expect(loadActiveProfile(activeProfile.id, mock.client)).resolves.toEqual(activeProfile)
    expect(mock.from).toHaveBeenCalledWith("profiles")
    expect(mock.select).toHaveBeenCalledWith("id, institutional_id, full_name, role, department, active, must_change_password")
    expect(mock.eqId).toHaveBeenCalledWith("id", activeProfile.id)
    expect(mock.eqActive).toHaveBeenCalledWith("active", true)
  })

  it("no convierte un perfil inactivo o invisible en una sesión de aplicación", async () => {
    const mock = profileClient({ data: null, error: null })
    await expect(loadActiveProfile(activeProfile.id, mock.client)).resolves.toBeNull()
  })

  it("conserva los errores reales de PostgREST", async () => {
    const mock = profileClient({ data: null, error: new Error("RLS error") })
    await expect(loadActiveProfile(activeProfile.id, mock.client)).rejects.toThrow("RLS error")
  })
})
