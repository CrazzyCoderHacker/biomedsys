import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  saveQuoteItems,
  setTrainingParticipants,
  provisionUser,
  deletePrivateAttachment,
  changeOwnPassword,
  syncAuthStatus,
  updateOwnProfile,
  uploadPrivateAttachment,
} from "./supabase"

function rpcClient(data: unknown) {
  const rpc = vi.fn().mockResolvedValue({ data, error: null })
  return { client: { rpc } as unknown as SupabaseClient, rpc }
}

describe("completion RPC clients", () => {
  it("sends participant assignment through the protected RPC", async () => {
    const { client, rpc } = rpcClient([])
    await setTrainingParticipants(8, ["user-1"], client)
    expect(rpc).toHaveBeenCalledWith("set_training_participants", {
      target_training_id: 8,
      participant_ids: ["user-1"],
    })
  })

  it("saves only normalized quote item fields", async () => {
    const quote = { id: 2, status: "en_revision", amount: 25 }
    const { client, rpc } = rpcClient(quote)
    await saveQuoteItems(2, "en_revision", [{ id: 90, quote_id: 2, description: "Prueba", quantity: 2, unit_cost: 12.5, line_total: 25 }], {}, client)
    expect(rpc).toHaveBeenCalledWith("save_quote_items", {
      target_quote_id: 2,
      new_status: "en_revision",
      items: [{ description: "Prueba", quantity: 2, unit_cost: 12.5 }],
      target_equipment_id: null,
      target_maintenance_id: null,
    })
  })

  it("does not allow role fields in self-service profile updates", async () => {
    const { client, rpc } = rpcClient({ id: "user-1", role: "usuario" })
    await updateOwnProfile("Persona Demo", "Urgencias", client)
    expect(rpc).toHaveBeenCalledWith("update_own_profile", {
      new_full_name: "Persona Demo",
      new_department: "Urgencias",
    })
  })

  it("rejects oversized files before contacting Storage", async () => {
    const upload = vi.fn()
    const client = { storage: { from: () => ({ upload }) } } as unknown as SupabaseClient
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf", { type: "application/pdf" })
    await expect(uploadPrivateAttachment(file, { maintenanceId: 1 }, "", client)).rejects.toThrow("10 MB")
    expect(upload).not.toHaveBeenCalled()
  })

  it("provisions Auth only through the protected Edge Function", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { id: "new-user", mustChangePassword: true }, error: null })
    const client = { functions: { invoke } } as unknown as SupabaseClient
    await provisionUser({ institutionalId: "02111111", fullName: "Usuario Prueba", role: "usuario", department: "Clínica", temporaryPassword: "Temporal12345" }, client)
    expect(invoke).toHaveBeenCalledWith("admin-users", { body: expect.objectContaining({ action: "provision", institutionalId: "02111111" }) })
  })

  it("deletes attachments through the compensating Edge Function", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { deleted: true, id: "attachment-1" }, error: null })
    const client = { functions: { invoke } } as unknown as SupabaseClient
    await deletePrivateAttachment("attachment-1", client)
    expect(invoke).toHaveBeenCalledWith("storage-admin", { body: { action: "delete", attachmentId: "attachment-1" } })
  })

  it("synchronizes profile activation through the protected backend", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { id: "profile-1", active: false }, error: null })
    const client = { functions: { invoke } } as unknown as SupabaseClient
    await syncAuthStatus("profile-1", false, client)
    expect(invoke).toHaveBeenCalledWith("admin-users", { body: { action: "set-auth-status", profileId: "profile-1", active: false } })
  })

  it("updates Auth before clearing the temporary-password flag", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null })
    const rpc = vi.fn().mockResolvedValue({ data: { id: "user-1", must_change_password: false }, error: null })
    const client = { auth: { updateUser }, rpc } as unknown as SupabaseClient
    await changeOwnPassword("NuevaClave1234", client)
    expect(updateUser).toHaveBeenCalledWith({ password: "NuevaClave1234" })
    expect(rpc).toHaveBeenCalledWith("complete_password_change")
  })
})
