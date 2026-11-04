import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { EquipmentInventoryDetail, Profile } from "../lib/supabase"

const { loadDashboardData } = vi.hoisted(() => ({ loadDashboardData: vi.fn() }))
vi.mock("../lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/supabase")>()
  return { ...original, loadDashboardData }
})

import { Dashboard } from "./DashboardViews"

afterEach(() => {
  cleanup()
  loadDashboardData.mockReset()
})

const manager: Profile = {
  id: "manager-id",
  institutional_id: "00000001",
  full_name: "Jefatura Biomédica",
  role: "jefe",
  department: "Ingeniería Clínica",
}

function equipment(index: number): EquipmentInventoryDetail {
  return {
    id: `equipment-${index}`,
    inventory_code: `EQ-${String(index).padStart(6, "0")}`,
    equipment_type: "Equipo médico",
    manufacturer: "Fabricante",
    model: "Modelo",
    hospital_area: "Hospitalización",
    location: null,
    status: "desconocido",
    serial_number: null,
    manufacture_year: null,
    acquisition_year: null,
    custodian_location_text: null,
    requires_review: true,
    current_risk_score: 10,
    current_risk_category: "medio",
  }
}

describe("dashboard real", () => {
  it("calcula los 100 equipos y no inventa reportes ni mantenimientos", async () => {
    loadDashboardData.mockResolvedValue({
      equipment: Array.from({ length: 100 }, (_, index) =>
        equipment(index + 1),
      ),
      reports: [],
      maintenances: [],
    })
    render(<Dashboard profile={manager} setView={() => undefined} />)
    expect(
      await screen.findByText("100 equipos con estado desconocido"),
    ).toBeTruthy()
    expect(screen.getByText("Sin reportes en el periodo")).toBeTruthy()
    expect(screen.getByText("No hay órdenes abiertas")).toBeTruthy()
    expect(screen.getAllByText("0").length).toBeGreaterThan(0)
  })

  it("expone el error de Supabase sin sustituirlo por datos falsos", async () => {
    loadDashboardData.mockRejectedValue(new Error("RLS rechazó la consulta"))
    render(<Dashboard profile={manager} setView={() => undefined} />)
    expect(await screen.findByText("RLS rechazó la consulta")).toBeTruthy()
    expect(screen.queryByText("1,284")).toBeNull()
  })
})
