import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const services = vi.hoisted(() => ({
  listMaintenanceOverview: vi.fn(),
  saveCorrectiveIntervention: vi.fn(),
  updateAssignedMaintenanceStatus: vi.fn(),
  validateCorrectiveClosure: vi.fn(),
}))

vi.mock("../lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/supabase")>()),
  ...services,
}))

import { ServiceOrdersView } from "./OperationalViews"

const maintenance = {
  id: 9,
  maintenance_number: "MT-2026-MC-0009",
  maintenance_code: "MC" as const,
  equipment_identifier: "EQ-000002",
  equipment_id: "asset-2",
  status: "en_proceso" as const,
  scheduled_at: "2026-11-06T14:00:00.000Z",
  assigned_to: "tech-1",
  priority: "alta" as const,
  completed_at: null,
  source_report_id: 14,
  validated_by: null,
  validated_at: null,
  closure_notes: null,
  report_number: "REP-000014",
  report_status: "En atención",
  record: null,
}

describe("corrective operational view", () => {
  beforeEach(() => {
    services.listMaintenanceOverview.mockResolvedValue({ catalog: [], maintenances: [maintenance] })
    services.saveCorrectiveIntervention.mockResolvedValue({ id: 3, maintenance_id: 9 })
    services.updateAssignedMaintenanceStatus.mockResolvedValue(maintenance)
    services.validateCorrectiveClosure.mockResolvedValue({ ...maintenance, status: "completado" })
  })

  it("lets the assigned technician document and submit the real intervention", async () => {
    render(<ServiceOrdersView role="tecnico" />)
    fireEvent.click(await screen.findByRole("button", { name: "Abrir" }))
    expect(screen.getByText(/Reporte REP-000014/i)).toBeTruthy()
    fireEvent.change(screen.getByText("Diagnóstico *").parentElement!.querySelector("textarea")!, { target: { value: "Conector flojo" } })
    fireEvent.change(screen.getByText("Trabajo realizado *").parentElement!.querySelector("textarea")!, { target: { value: "Ajuste y limpieza" } })
    fireEvent.change(screen.getByText("Resultados de pruebas *").parentElement!.querySelector("textarea")!, { target: { value: "Pruebas conformes" } })
    fireEvent.change(screen.getByText("Condición final *").parentElement!.querySelector("select")!, { target: { value: "operativo" } })
    fireEvent.click(screen.getByRole("button", { name: "Enviar para validación" }))
    await waitFor(() => expect(services.saveCorrectiveIntervention).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        diagnosis: "Conector flojo",
        workPerformed: "Ajuste y limpieza",
        testResults: "Pruebas conformes",
        equipmentCondition: "operativo",
      }),
    ))
  })
})
