import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { InventoryAdministration, inventoryIssueLabel, type InventoryAdministrationApi } from "./InventoryAdministration"
import type { EquipmentInventoryBundle, InventoryAdministrationData } from "../lib/supabase"

const bundle: EquipmentInventoryBundle = {
  equipment: {
    id: "asset-52", inventory_code: "EQ-000052", equipment_type: "Equipo médico",
    manufacturer: "Fabricante", model: "Modelo", hospital_area: "Urgencias", location: "Cubículo 1",
    status: "desconocido", serial_number: "3979000122", manufacture_year: null,
    acquisition_year: null, custodian_location_text: null, requires_review: true,
    current_risk_score: 8, current_risk_category: "medio",
  },
  risks: [], documents: [],
  programs: [{ id: 4, name: "Rutina preventiva", procedure_text: "Procedimiento validado", interval_months: null, periodicity_basis: null, requires_review: true }],
  issues: [{ id: 9, issue_code: "duplicate_serial", severity: "error", field_name: "SN", source_value: "3979000122", details: "Serie compartida", review_status: "pendiente" }],
  restricted: false,
}

const adminData: InventoryAdministrationData = {
  asset: { id: "asset-52", serial_number: "3979000122", serial_is_placeholder: false, manufacture_year: null, acquisition_year: null, hospital_area_id: 1, location_id: 2, custodian_location_text: null, status: "desconocido" },
  areas: [{ id: 1, name: "Urgencias" }],
  locations: [{ id: 2, name: "Cubículo 1", hospital_area_id: 1 }],
  programs: [{ maintenance_program_id: 4, interval_months: null, periodicity_basis: null, periodicity_notes: null, reference_date: null, last_completed_on: null, next_due_on: null }],
  issueReviews: [],
  technicians: [{ id: "tech-1", institutional_id: "T001", full_name: "Técnico Prueba", role: "tecnico", department: null }],
}

function api(): InventoryAdministrationApi {
  return {
    load: vi.fn().mockResolvedValue(adminData),
    updateAsset: vi.fn().mockResolvedValue(adminData.asset),
    configureProgram: vi.fn().mockResolvedValue(adminData.programs[0]),
    schedule: vi.fn().mockResolvedValue({}),
    reviewIssue: vi.fn().mockResolvedValue(bundle.issues[0]),
  }
}

describe("InventoryAdministration", () => {
  it("mantiene las escrituras deshabilitadas antes de desplegar la migración", () => {
    const service = api()
    render(<InventoryAdministration bundle={bundle} enabled={false} api={service} onChanged={() => undefined} />)
    expect(screen.getByText(/pendiente de aprobación/i)).toBeTruthy()
    expect(service.load).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: /guardar cambios/i })).toBeNull()
  })

  it("carga herramientas reales y envía la edición del activo", async () => {
    const service = api()
    render(<InventoryAdministration bundle={bundle} enabled api={service} onChanged={() => undefined} />)
    const save = await screen.findByRole("button", { name: /guardar cambios/i })
    fireEvent.click(save)
    await waitFor(() => expect(service.updateAsset).toHaveBeenCalledWith(expect.objectContaining({ id: "asset-52", serial_number: "3979000122" })))
  })

  it("requiere justificación antes de revisar una incidencia", async () => {
    const service = api()
    render(<InventoryAdministration bundle={bundle} enabled api={service} onChanged={() => undefined} />)
    const review = await screen.findByRole("button", { name: /registrar revisión/i })
    fireEvent.click(review)
    expect(await screen.findByText(/observaciones y la justificación son obligatorias/i)).toBeTruthy()
    expect(service.reviewIssue).not.toHaveBeenCalled()
  })

  it("traduce la serie duplicada sin afirmar que los equipos sean iguales", () => {
    expect(inventoryIssueLabel("duplicate_serial")).toBe("Número de serie compartido o duplicado, pendiente de verificar")
  })
})
