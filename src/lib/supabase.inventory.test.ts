import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getInventoryCapabilities,
  listEquipmentInventory,
  type EquipmentDirectoryItem,
  type EquipmentInventoryDetail,
} from "./supabase";

const directoryItem: EquipmentDirectoryItem = {
  id: "11111111-1111-1111-1111-111111111111",
  inventory_code: "EQ-000001",
  equipment_type: "Monitor",
  manufacturer: "Fabricante",
  model: "Modelo",
  hospital_area: "Urgencias",
  location: "Cubículo 1",
  status: "operativo",
};

const inventoryItem: EquipmentInventoryDetail = {
  ...directoryItem,
  serial_number: "SERIE-1",
  manufacture_year: 2022,
  acquisition_year: 2023,
  custodian_location_text: null,
  requires_review: true,
  current_risk_score: 16,
  current_risk_category: "alto",
};

describe("consultas de inventario", () => {
  it("usa el directorio limitado para usuario y filtra el área sin solicitar datos técnicos", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [directoryItem], error: null });
    const client = { rpc } as unknown as SupabaseClient;

    const result = await listEquipmentInventory(
      "usuario",
      { searchTerm: "monitor", hospitalArea: "Urgencias", riskLevel: "alto" },
      client,
    );

    expect(rpc).toHaveBeenCalledWith("search_equipment_directory", { search_term: "monitor" });
    expect(result).toHaveLength(1);
    expect(result[0].serial_number).toBeNull();
    expect(result[0].current_risk_category).toBeNull();
  });

  it("usa la consulta técnica con búsqueda, área y riesgo para jefe", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [inventoryItem], error: null });
    const client = { rpc } as unknown as SupabaseClient;

    const result = await listEquipmentInventory(
      "jefe",
      { searchTerm: "EQ-000001", hospitalArea: "Urgencias", riskLevel: "alto" },
      client,
    );

    expect(rpc).toHaveBeenCalledWith("search_equipment_inventory", {
      search_term: "EQ-000001",
      area_filter: "Urgencias",
      risk_filter: "alto",
    });
    expect(result).toEqual([inventoryItem]);
  });

  it("falla de forma explícita cuando Supabase no está configurado", async () => {
    await expect(listEquipmentInventory("tecnico", {}, null)).rejects.toThrow("Supabase no está configurado");
  });
});

describe("permisos del inventario", () => {
  it("limita la ficha clínica y reserva incidencias para jefe", () => {
    expect(getInventoryCapabilities("usuario")).toEqual({
      canViewFullDetail: false,
      canViewRisk: false,
      canViewDocuments: false,
      canViewPrograms: false,
      canViewIssues: false,
    });
    expect(getInventoryCapabilities("tecnico").canViewIssues).toBe(false);
    expect(getInventoryCapabilities("jefe").canViewIssues).toBe(true);
  });
});
