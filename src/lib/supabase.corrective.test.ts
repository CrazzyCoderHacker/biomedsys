import { describe, expect, it, vi } from "vitest"
import {
  createCorrectiveOrderFromReport,
  saveCorrectiveIntervention,
  validateCorrectiveClosure,
} from "./supabase"

function rpcClient(result: unknown = {}) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: result, error: null }),
  }
}

describe("corrective workflow RPC client", () => {
  it("creates the report/order relation through one server transaction", async () => {
    const client = rpcClient({ id: 9, maintenance_number: "MT-2026-MC-0009" })
    await createCorrectiveOrderFromReport(14, "tech-1", "alta", "2026-11-06T18:00:00.000Z", client as never)
    expect(client.rpc).toHaveBeenCalledWith("create_corrective_order_from_report", {
      target_report_id: 14,
      target_assigned_to: "tech-1",
      target_priority: "alta",
      target_scheduled_at: "2026-11-06T18:00:00.000Z",
    })
  })

  it("sends the complete technical record to the protected RPC", async () => {
    const client = rpcClient({ id: 3, maintenance_id: 9 })
    await saveCorrectiveIntervention(9, {
      startedAt: "2026-11-06T15:00:00.000Z",
      completedAt: "2026-11-06T16:00:00.000Z",
      diagnosis: "Conector flojo",
      workPerformed: "Ajuste y limpieza",
      testResults: "Pruebas conformes",
      equipmentCondition: "operativo",
      technicalNotes: "Sin evidencia adjunta",
    }, client as never)
    expect(client.rpc).toHaveBeenCalledWith("save_corrective_intervention", expect.objectContaining({
      target_maintenance_id: 9,
      new_equipment_condition: "operativo",
      new_test_results: "Pruebas conformes",
    }))
  })

  it("uses the manager-only closure transaction", async () => {
    const client = rpcClient({ id: 9, status: "completado" })
    await validateCorrectiveClosure(9, "Expediente revisado", client as never)
    expect(client.rpc).toHaveBeenCalledWith("validate_corrective_closure", {
      target_maintenance_id: 9,
      validation_notes: "Expediente revisado",
    })
  })
})
