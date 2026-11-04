import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createReport, updateAssignedMaintenanceStatus, updateReportWorkflow, type CreateReportInput } from "./supabase"

const input: CreateReportInput = {
  equipmentId: "11111111-1111-1111-1111-111111111111",
  equipmentIdentifier: "EQ-000052",
  eventDate: "2026-11-04",
  eventType: "Falla",
  service: "Urgencias",
  location: "Cubículo 2",
  manufacturer: "Fabricante real",
  modelSerial: "Modelo real / 3979000122",
  description: "Descripción controlada",
  patientOutcome: "Sin lesión",
  actionTaken: "Equipo retirado",
}

describe("creación de reportes vinculados", () => {
  it("inserta el UUID seleccionado sin repetir una búsqueda ambigua", async () => {
    const single = vi.fn().mockResolvedValue({ data: { report_number: "RP-0001" }, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    const from = vi.fn().mockReturnValue({ insert })
    const client = { from, rpc: vi.fn() } as unknown as SupabaseClient

    await expect(createReport(input, client)).resolves.toBe("RP-0001")
    expect(from).toHaveBeenCalledWith("reports")
    expect(client.rpc).not.toHaveBeenCalled()
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      equipment_id: input.equipmentId,
      equipment_identifier: "EQ-000052",
    }))
  })

  it("impide enviar texto libre sin una selección registrada", async () => {
    const client = { from: vi.fn() } as unknown as SupabaseClient
    await expect(createReport({ ...input, equipmentId: null }, client)).rejects.toThrow("Selecciona explícitamente")
    expect(client.from).not.toHaveBeenCalled()
  })
})

describe("operación de órdenes asignadas", () => {
  it("delega el cambio de estado en la función protegida de PostgreSQL", async () => {
    const updated = { id: 17, status: "en_proceso" }
    const rpc = vi.fn().mockResolvedValue({ data: updated, error: null })
    const client = { rpc } as unknown as SupabaseClient

    await expect(updateAssignedMaintenanceStatus(17, "en_proceso", client)).resolves.toEqual(updated)
    expect(rpc).toHaveBeenCalledWith("update_assigned_maintenance_status", {
      target_maintenance_id: 17,
      new_status: "en_proceso",
    })
  })
})

describe("gestión de reportes", () => {
  it("actualiza únicamente prioridad y estado del folio seleccionado", async () => {
    const report = { report_number: "REP-000052", priority: "Alta", status: "Clasificado" }
    const single = vi.fn().mockResolvedValue({ data: report, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const eq = vi.fn().mockReturnValue({ select })
    const update = vi.fn().mockReturnValue({ eq })
    const client = { from: vi.fn().mockReturnValue({ update }) } as unknown as SupabaseClient

    await expect(updateReportWorkflow(report.report_number, { priority: report.priority, status: report.status }, client)).resolves.toEqual(report)
    expect(update).toHaveBeenCalledWith({ priority: "Alta", status: "Clasificado" })
    expect(eq).toHaveBeenCalledWith("report_number", "REP-000052")
  })
})
