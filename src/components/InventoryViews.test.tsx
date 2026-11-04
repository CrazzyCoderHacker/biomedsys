import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { EquipmentDetail, Inventory, type InventoryApi } from "./InventoryViews"
import type {
  EquipmentInventoryBundle,
  EquipmentInventoryDetail,
} from "../lib/supabase"

afterEach(cleanup)

const equipment: EquipmentInventoryDetail = {
  id: "11111111-1111-1111-1111-111111111111",
  inventory_code: "EQ-000001",
  equipment_type: "Monitor de signos vitales",
  manufacturer: "Fabricante real",
  model: "Modelo real",
  hospital_area: "Urgencias",
  location: "Cubículo 1",
  status: "operativo",
  serial_number: "SERIE-1",
  manufacture_year: 2022,
  acquisition_year: 2023,
  custodian_location_text: "Urgencias",
  requires_review: true,
  current_risk_score: 16,
  current_risk_category: "alto",
}

const bundle: EquipmentInventoryBundle = {
  equipment,
  risks: [
    {
      id: 1,
      methodology_name: "Evaluación de equipo médico",
      methodology_version: "Final.xlsx",
      function_score: 9,
      clinical_application_score: 4,
      maintenance_requirement_score: 3,
      total_score: 16,
      category: "alto",
      assessed_at: null,
    },
  ],
  documents: [
    {
      id: 1,
      document_type: "manual_usuario",
      title: "Manual",
      url: "https://example.test/manual",
      review_status: "pendiente",
    },
  ],
  programs: [
    {
      id: 1,
      name: "Rutina preventiva",
      procedure_text: "Inspección visual",
      interval_months: null,
      periodicity_basis: null,
      requires_review: true,
    },
  ],
  issues: [
    {
      id: 1,
      issue_code: "duplicate_serial",
      severity: "error",
      field_name: "serial_number",
      source_value: "SERIE-1",
      details: "Serial repetido",
      review_status: "pendiente",
    },
  ],
  restricted: false,
}

function api(overrides: Partial<InventoryApi> = {}): InventoryApi {
  return {
    list: vi.fn().mockResolvedValue([equipment]),
    getBundle: vi.fn().mockResolvedValue(bundle),
    ...overrides,
  }
}

describe("inventario", () => {
  it("muestra configuración pendiente y no consulta datos", () => {
    const inventoryApi = api()
    render(
      <Inventory
        role="jefe"
        onSelectEquipment={() => undefined}
        api={inventoryApi}
        configured={false}
      />,
    )
    expect(screen.getByText("Conexión con Supabase pendiente")).toBeTruthy()
    expect(inventoryApi.list).not.toHaveBeenCalled()
  })

  it("renderiza resultados reales y abre la ficha seleccionada", async () => {
    const onSelect = vi.fn()
    render(
      <Inventory
        role="jefe"
        onSelectEquipment={onSelect}
        api={api()}
        configured
      />,
    )
    expect(await screen.findByText("EQ-000001")).toBeTruthy()
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir ficha EQ-000001" }),
    )
    expect(onSelect).toHaveBeenCalledWith(equipment.id)
  })

  it("oculta el filtro de riesgo para usuario", async () => {
    render(
      <Inventory
        role="usuario"
        onSelectEquipment={() => undefined}
        api={api()}
        configured
      />,
    )
    await screen.findByText("EQ-000001")
    expect(screen.queryByText("Riesgo")).toBeNull()
  })

  it("muestra un estado vacío sin inventar equipos", async () => {
    render(
      <Inventory
        role="tecnico"
        onSelectEquipment={() => undefined}
        api={api({ list: vi.fn().mockResolvedValue([]) })}
        configured
      />,
    )
    expect(await screen.findByText("No hay equipos para mostrar")).toBeTruthy()
  })

  it("muestra el error de consulta y permite reintentar", async () => {
    render(
      <Inventory
        role="jefe"
        onSelectEquipment={() => undefined}
        api={api({
          list: vi
            .fn()
            .mockRejectedValue(
              new Error("Servicio temporalmente no disponible"),
            ),
        })}
        configured
      />,
    )
    expect(
      await screen.findByText("Servicio temporalmente no disponible"),
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy()
  })

  it("pagina los 100 equipos sin perder el conteo real", async () => {
    const oneHundred = Array.from({ length: 100 }, (_, index) => ({
      ...equipment,
      id: `equipment-${index + 1}`,
      inventory_code: `EQ-${String(index + 1).padStart(6, "0")}`,
    }))
    render(
      <Inventory
        role="jefe"
        onSelectEquipment={() => undefined}
        api={api({ list: vi.fn().mockResolvedValue(oneHundred) })}
        configured
      />,
    )
    expect(await screen.findByText("100 equipos encontrados")).toBeTruthy()
    expect(screen.getByText("1 / 5")).toBeTruthy()
    expect(screen.queryByText("EQ-000021")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }))
    expect(screen.getByText("2 / 5")).toBeTruthy()
    expect(screen.getByText("EQ-000021")).toBeTruthy()
  })

  it("envía búsqueda y filtros seleccionados a la consulta real", async () => {
    const list = vi.fn().mockResolvedValue([equipment])
    render(
      <Inventory
        role="jefe"
        onSelectEquipment={() => undefined}
        api={api({ list })}
        configured
      />,
    )
    await screen.findByText("EQ-000001")
    fireEvent.change(screen.getByLabelText("Buscar equipo"), {
      target: { value: "Monitor" },
    })
    fireEvent.change(screen.getByText("Todas las áreas").closest("select")!, {
      target: { value: "Urgencias" },
    })
    fireEvent.change(screen.getByText("Todos los niveles").closest("select")!, {
      target: { value: "alto" },
    })
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith("jefe", {
        searchTerm: "Monitor",
        hospitalArea: "Urgencias",
        riskLevel: "alto",
      }),
    )
  })
})

describe("ficha de equipo", () => {
  it("muestra riesgos, documentos, rutinas e incidencias al jefe", async () => {
    render(
      <EquipmentDetail
        equipmentId={equipment.id}
        role="jefe"
        onBack={() => undefined}
        api={api()}
        configured
      />,
    )
    expect(await screen.findByText("Evaluación de riesgo")).toBeTruthy()
    expect(screen.getByText("Manual")).toBeTruthy()
    expect(
      screen.getByText("Periodicidad pendiente de definición"),
    ).toBeTruthy()
    expect(screen.getByText("Serial repetido")).toBeTruthy()
  })

  it("explica la ficha limitada al usuario y no muestra secciones técnicas", async () => {
    const restrictedBundle = {
      ...bundle,
      risks: [],
      documents: [],
      programs: [],
      issues: [],
      restricted: true,
    }
    render(
      <EquipmentDetail
        equipmentId={equipment.id}
        role="usuario"
        onBack={() => undefined}
        api={api({ getBundle: vi.fn().mockResolvedValue(restrictedBundle) })}
        configured
      />,
    )
    expect(await screen.findByText("Ficha clínica limitada")).toBeTruthy()
    expect(screen.queryByText("Evaluación de riesgo")).toBeNull()
    expect(screen.queryByText("Incidencias pendientes")).toBeNull()
  })
})
