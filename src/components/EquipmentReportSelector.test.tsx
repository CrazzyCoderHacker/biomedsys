import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { EquipmentReportSelector } from "./EquipmentReportSelector"
import type { EquipmentInventoryDetail } from "../lib/supabase"

afterEach(cleanup)

const equipment: EquipmentInventoryDetail = {
  id: "11111111-1111-1111-1111-111111111111",
  inventory_code: "EQ-000052",
  equipment_type: "Monitor de signos vitales",
  manufacturer: "Fabricante real",
  model: "Modelo real",
  hospital_area: "Urgencias",
  location: "Cubículo 2",
  status: "operativo",
  serial_number: "3979000122",
  manufacture_year: 2020,
  acquisition_year: 2021,
  custodian_location_text: null,
  requires_review: true,
  current_risk_score: 8,
  current_risk_category: "medio",
}

describe("EquipmentReportSelector", () => {
  it("espera una consulta útil y selecciona explícitamente el UUID real", async () => {
    const search = vi.fn().mockResolvedValue([equipment])
    const onInputChange = vi.fn()
    const onSelect = vi.fn()
    const { rerender } = render(
      <EquipmentReportSelector role="jefe" value="E" selected={null} onInputChange={onInputChange} onSelect={onSelect} search={search} />,
    )
    await new Promise((resolve) => window.setTimeout(resolve, 330))
    expect(search).not.toHaveBeenCalled()

    rerender(<EquipmentReportSelector role="jefe" value="EQ-000052" selected={null} onInputChange={onInputChange} onSelect={onSelect} search={search} />)
    expect(await screen.findByRole("option", { name: /EQ-000052/i })).toBeTruthy()
    fireEvent.click(screen.getByRole("option", { name: /EQ-000052/i }))
    expect(onSelect).toHaveBeenCalledWith(equipment)
    expect(search).toHaveBeenCalledTimes(1)
  })

  it("muestra carga vacía y error sin inventar resultados", async () => {
    const search = vi.fn().mockResolvedValue([])
    const { rerender } = render(
      <EquipmentReportSelector role="usuario" value="equipo desconocido" selected={null} onInputChange={() => undefined} onSelect={() => undefined} search={search} />,
    )
    expect(await screen.findByText(/no se encontraron equipos registrados/i)).toBeTruthy()

    search.mockRejectedValueOnce(new Error("Consulta no autorizada"))
    rerender(<EquipmentReportSelector role="usuario" value="otro equipo" selected={null} onInputChange={() => undefined} onSelect={() => undefined} search={search} />)
    expect((await screen.findByRole("alert")).textContent).toContain("Consulta no autorizada")
  })

  it("confirma código, datos técnicos, serie y ubicación de la selección", () => {
    render(
      <EquipmentReportSelector role="jefe" value="EQ-000052" selected={equipment} onInputChange={() => undefined} onSelect={() => undefined} />,
    )
    expect(screen.getByRole("status").textContent).toContain("3979000122")
    expect(screen.getByRole("status").textContent).toContain("Cubículo 2")
  })
})
