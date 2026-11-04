import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Role = "jefe" | "tecnico" | "usuario";

export type Profile = {
  id: string;
  institutional_id: string;
  full_name: string;
  role: Role;
  department: string | null;
};

export type Training = {
  id: number;
  training_number: string;
  title: string;
  purpose: string;
  purposeLabel: string;
  recurrence: string;
  scheduled_at: string;
  location: string | null;
  description: string | null;
};

export type AuditEntry = {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
};

export type Quote = { id: number; quote_number: string; supplier: string; equipment_description: string; amount: number; currency: string; status: string; notes: string | null; created_at: string };

export type EquipmentStatus = "operativo" | "en_reparacion" | "fuera_de_servicio" | "baja" | "desconocido";

export type EquipmentDirectoryItem = {
  id: string;
  inventory_code: string;
  equipment_type: string;
  manufacturer: string;
  model: string;
  hospital_area: string | null;
  location: string | null;
  status: EquipmentStatus;
};

export type EquipmentInventoryDetail = EquipmentDirectoryItem & {
  serial_number: string | null;
  manufacture_year: number | null;
  acquisition_year: number | null;
  custodian_location_text: string | null;
  requires_review: boolean;
  current_risk_score: number | null;
  current_risk_category: "bajo" | "medio" | "alto" | null;
};

export type RiskLevel = "bajo" | "medio" | "alto";

export type InventoryFilters = {
  searchTerm?: string;
  hospitalArea?: string;
  riskLevel?: RiskLevel | "";
};

export type RiskAssessment = {
  id: number;
  methodology_name: string;
  methodology_version: string;
  function_score: number;
  clinical_application_score: number;
  maintenance_requirement_score: number;
  total_score: number;
  category: RiskLevel;
  assessed_at: string | null;
};

export type EquipmentDocument = {
  id: number;
  document_type: "manual_usuario" | "manual_servicio" | "otro";
  title: string | null;
  url: string;
  review_status: "pendiente" | "confirmado" | "corregido" | "descartado";
};

export type MaintenanceProgram = {
  id: number;
  name: string;
  procedure_text: string;
  interval_months: number | null;
  periodicity_basis: string | null;
  requires_review: boolean;
};

export type InventoryIssue = {
  id: number;
  issue_code: string;
  severity: "informativo" | "advertencia" | "error";
  field_name: string | null;
  source_value: string | null;
  details: string;
  review_status: "pendiente" | "confirmado" | "corregido" | "descartado";
};

export type EquipmentInventoryBundle = {
  equipment: EquipmentInventoryDetail;
  risks: RiskAssessment[];
  documents: EquipmentDocument[];
  programs: MaintenanceProgram[];
  issues: InventoryIssue[];
  restricted: boolean;
};

export type InventoryCapabilities = {
  canViewFullDetail: boolean;
  canViewRisk: boolean;
  canViewDocuments: boolean;
  canViewPrograms: boolean;
  canViewIssues: boolean;
};

export function getInventoryCapabilities(role: Role): InventoryCapabilities {
  const isBiomedicalStaff = role === "tecnico" || role === "jefe";
  return {
    canViewFullDetail: isBiomedicalStaff,
    canViewRisk: isBiomedicalStaff,
    canViewDocuments: isBiomedicalStaff,
    canViewPrograms: isBiomedicalStaff,
    canViewIssues: role === "jefe",
  };
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function authEmailForInstitutionalId(institutionalId: string) {
  return `${institutionalId}@biomedgest.local`;
}

export async function signInWithInstitutionalId(
  institutionalId: string,
  password: string,
) {
  if (!supabase) {
    throw new Error("Supabase no está configurado. Define las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.");
  }

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: authEmailForInstitutionalId(institutionalId),
    password,
  });
  if (authError) throw authError;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, institutional_id, full_name, role, department")
    .eq("id", authData.user.id)
    .single<Profile>();
  if (profileError) {
    await supabase.auth.signOut();
    throw profileError;
  }

  return profile;
}

export async function getCurrentProfile() {
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, institutional_id, full_name, role, department")
    .eq("id", sessionData.session.user.id)
    .single<Profile>();
  if (error) throw error;
  return data;
}

export type CreateReportInput = {
  equipmentIdentifier: string;
  eventDate: string;
  eventType: string;
  service: string;
  location: string;
  manufacturer: string;
  modelSerial: string;
  description: string;
  patientOutcome: string;
  actionTaken: string;
};

export async function createReport(input: CreateReportInput) {
  if (!supabase) {
    throw new Error("Supabase no está configurado.");
  }

  const { data, error } = await supabase
    .from("reports")
    .insert({
      equipment_identifier: input.equipmentIdentifier,
      event_date: input.eventDate,
      event_type: input.eventType,
      service: input.service,
      location: input.location || null,
      manufacturer: input.manufacturer || null,
      model_serial: input.modelSerial || null,
      description: input.description,
      patient_outcome: input.patientOutcome || null,
      action_taken: input.actionTaken || null,
    })
    .select("report_number")
    .single<{ report_number: string }>();
  if (error) throw error;
  return data.report_number;
}

export type ReportSummary = {
  report_number: string;
  equipment_identifier: string;
  description: string;
  service: string;
  priority: string;
  status: string;
  created_at: string;
};

export async function listReports() {
  if (!supabase) {
    throw new Error("Supabase no está configurado.");
  }
  const { data, error } = await supabase
    .from("reports")
    .select("report_number, equipment_identifier, description, service, priority, status, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ReportSummary[];
}

export async function listTrainings() {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.from("trainings").select("id, training_number, title, purpose, recurrence, scheduled_at, location, description").order("scheduled_at");
  if (error) throw error;
  const labels: Record<string, string> = { equipo_nuevo: "Equipo nuevo", personal_nuevo: "Personal nuevo", necesidad_detectada: "Necesidad detectada", protocolo: "Protocolo" };
  return (data || []).map((training) => ({ ...training, purposeLabel: labels[training.purpose] || training.purpose })) as Training[];
}

export async function createTraining(input: { title: string; purpose: string; recurrence: string; scheduledAt: string; location: string; description: string }) {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user.id) throw new Error("La sesión expiró.");
  const { data, error } = await supabase.from("trainings").insert({
    title: input.title,
    purpose: input.purpose,
    recurrence: input.recurrence,
    scheduled_at: input.scheduledAt,
    location: input.location || null,
    description: input.description || null,
    instructor_id: session.session.user.id,
  }).select("id, training_number, title, purpose, recurrence, scheduled_at, location, description").single();
  if (error) throw error;
  const labels: Record<string, string> = { equipo_nuevo: "Equipo nuevo", personal_nuevo: "Personal nuevo", necesidad_detectada: "Necesidad detectada", protocolo: "Protocolo" };
  return { ...data, purposeLabel: labels[data.purpose] || data.purpose } as Training;
}

export async function listProfiles() {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.from("profiles").select("id, institutional_id, full_name, role, department").eq("active", true).order("institutional_id");
  if (error) throw error;
  return (data || []) as Profile[];
}

export async function listAuditLog() {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.from("audit_log").select("id, action, entity_type, entity_id, created_at").order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return (data || []) as AuditEntry[];
}

export async function listQuotes() {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.from("quotes").select("id, quote_number, supplier, equipment_description, amount, currency, status, notes, created_at").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Quote[];
}

export async function createQuote(input: { supplier: string; equipmentDescription: string; amount: number; notes: string }) {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.from("quotes").insert({ supplier: input.supplier, equipment_description: input.equipmentDescription, amount: input.amount, notes: input.notes || null }).select("id, quote_number, supplier, equipment_description, amount, currency, status, notes, created_at").single();
  if (error) throw error;
  return data as Quote;
}

export async function createAccessRequest(input: { institutionalId: string; fullName: string; role: Role; department: string }) {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { error } = await supabase.from("user_access_requests").insert({ institutional_id: input.institutionalId, full_name: input.fullName, role: input.role, department: input.department || null });
  if (error) throw error;
}

function requireSupabase(client: SupabaseClient | null = supabase) {
  if (!client) {
    throw new Error("Supabase no está configurado. Agrega las variables públicas en .env.local.");
  }
  return client;
}

export async function searchEquipmentDirectory(
  searchTerm = "",
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client);
  const { data, error } = await configuredClient.rpc("search_equipment_directory", {
    search_term: searchTerm.trim() || null,
  });
  if (error) throw error;
  return (data || []) as EquipmentDirectoryItem[];
}

export async function listEquipmentInventory(
  role: Role,
  filters: InventoryFilters = {},
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client);
  if (role === "usuario") {
    const directory = await searchEquipmentDirectory(filters.searchTerm, configuredClient);
    return directory
      .filter((item) => !filters.hospitalArea || item.hospital_area === filters.hospitalArea)
      .map<EquipmentInventoryDetail>((item) => ({
        ...item,
        serial_number: null,
        manufacture_year: null,
        acquisition_year: null,
        custodian_location_text: null,
        requires_review: false,
        current_risk_score: null,
        current_risk_category: null,
      }));
  }

  const { data, error } = await configuredClient.rpc("search_equipment_inventory", {
    search_term: filters.searchTerm?.trim() || null,
    area_filter: filters.hospitalArea?.trim() || null,
    risk_filter: filters.riskLevel || null,
  });
  if (error) throw error;
  return (data || []) as EquipmentInventoryDetail[];
}

export async function getEquipmentInventoryDetail(
  equipmentId: string,
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client);
  const { data, error } = await configuredClient
    .from("equipment_inventory_detail")
    .select("id, inventory_code, equipment_type, manufacturer, model, serial_number, manufacture_year, acquisition_year, hospital_area, location, custodian_location_text, status, requires_review, current_risk_score, current_risk_category")
    .eq("id", equipmentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Equipo no encontrado o sin permisos para consultar su ficha.");
  return data as EquipmentInventoryDetail;
}

function unwrapRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getEquipmentInventoryBundle(
  equipmentId: string,
  role: Role,
  client: SupabaseClient | null = supabase,
): Promise<EquipmentInventoryBundle> {
  const configuredClient = requireSupabase(client);
  const capabilities = getInventoryCapabilities(role);

  if (!capabilities.canViewFullDetail) {
    const directory = await searchEquipmentDirectory("", configuredClient);
    const item = directory.find((candidate) => candidate.id === equipmentId);
    if (!item) throw new Error("Equipo no encontrado o sin permisos para consultarlo.");
    return {
      equipment: {
        ...item,
        serial_number: null,
        manufacture_year: null,
        acquisition_year: null,
        custodian_location_text: null,
        requires_review: false,
        current_risk_score: null,
        current_risk_category: null,
      },
      risks: [],
      documents: [],
      programs: [],
      issues: [],
      restricted: true,
    };
  }

  const equipment = await getEquipmentInventoryDetail(equipmentId, configuredClient);
  const [riskResult, documentResult, programResult] = await Promise.all([
    configuredClient
      .from("risk_assessments")
      .select("id, methodology_name, methodology_version, function_score, clinical_application_score, maintenance_requirement_score, total_score, category, assessed_at")
      .eq("equipment_id", equipmentId)
      .order("created_at", { ascending: false }),
    configuredClient
      .from("equipment_document_links")
      .select("equipment_documents(id, document_type, title, url, review_status)")
      .eq("equipment_id", equipmentId),
    configuredClient
      .from("equipment_maintenance_programs")
      .select("maintenance_programs(id, name, procedure_text, interval_months, periodicity_basis, requires_review)")
      .eq("equipment_id", equipmentId),
  ]);

  if (riskResult.error) throw riskResult.error;
  if (documentResult.error) throw documentResult.error;
  if (programResult.error) throw programResult.error;

  let issues: InventoryIssue[] = [];
  if (capabilities.canViewIssues) {
    const issueResult = await configuredClient
      .from("inventory_import_issues")
      .select("id, issue_code, severity, field_name, source_value, details, review_status")
      .eq("equipment_id", equipmentId)
      .eq("review_status", "pendiente")
      .order("severity", { ascending: false });
    if (issueResult.error) throw issueResult.error;
    issues = (issueResult.data || []) as InventoryIssue[];
  }

  const documents = (documentResult.data || [])
    .map((row) => unwrapRelation(row.equipment_documents as EquipmentDocument | EquipmentDocument[] | null))
    .filter((document): document is EquipmentDocument => Boolean(document));
  const programs = (programResult.data || [])
    .map((row) => unwrapRelation(row.maintenance_programs as MaintenanceProgram | MaintenanceProgram[] | null))
    .filter((program): program is MaintenanceProgram => Boolean(program));

  return {
    equipment,
    risks: (riskResult.data || []) as RiskAssessment[],
    documents,
    programs,
    issues,
    restricted: false,
  };
}
