import { createClient } from "@supabase/supabase-js";

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

export async function searchEquipmentDirectory(searchTerm = "") {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.rpc("search_equipment_directory", {
    search_term: searchTerm.trim() || null,
  });
  if (error) throw error;
  return (data || []) as EquipmentDirectoryItem[];
}

export async function getEquipmentInventoryDetail(equipmentId: string) {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase
    .from("equipment_inventory_detail")
    .select("id, inventory_code, equipment_type, manufacturer, model, serial_number, manufacture_year, acquisition_year, hospital_area, location, custodian_location_text, status, requires_review, current_risk_score, current_risk_category")
    .eq("id", equipmentId)
    .single();
  if (error) throw error;
  return data as EquipmentInventoryDetail;
}
