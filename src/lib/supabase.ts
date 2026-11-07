import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export type Role = "jefe" | "tecnico" | "usuario"

export type Profile = {
  id: string

  institutional_id: string

  full_name: string

  role: Role

  department: string | null

  active: boolean
  must_change_password?: boolean
}

export type Training = {
  id: number

  training_number: string

  title: string

  purpose: string

  purposeLabel: string

  recurrence: string

  scheduled_at: string

  location: string | null

  description: string | null
  status: "programada" | "en_curso" | "completada" | "cancelada"
  instructor_id: string
  equipment_id?: string | null
}

export type TrainingParticipant = {
  training_id: number
  participant_id: string
  attendance_status: "convocado" | "confirmado" | "asistio" | "no_asistio"
  profile?: Pick<Profile, "full_name" | "institutional_id" | "role">
}

export type AuditEntry = {
  id: number

  action: string

  entity_type: string

  entity_id: string | null

  created_at: string
}

export type ProfileChange = {
  id: number; profile_id: string; changed_by: string; previous_role: Role; new_role: Role;
  previous_active: boolean; new_active: boolean; reason: string; changed_at: string
}

export type AccessRequest = { id: number; institutional_id: string; full_name: string; role: Role; department: string | null; status: string; created_at: string }

export type Quote = {
  id: number
  quote_number: string
  supplier: string
  equipment_description: string
  amount: number
  currency: string
  status: string
  notes: string | null
  created_at: string
  equipment_id?: string | null
  maintenance_id?: number | null
}

export type QuoteItem = { id?: number; quote_id?: number; description: string; quantity: number; unit_cost: number; line_total?: number }

export type EquipmentStatus = "operativo" | "en_reparacion" | "fuera_de_servicio" | "baja" | "desconocido"

export type EquipmentDirectoryItem = {
  id: string

  inventory_code: string

  equipment_type: string

  manufacturer: string

  model: string

  hospital_area: string | null

  location: string | null

  status: EquipmentStatus
}

export type EquipmentInventoryDetail = EquipmentDirectoryItem & {
  serial_number: string | null

  manufacture_year: number | null

  acquisition_year: number | null

  custodian_location_text: string | null

  requires_review: boolean

  current_risk_score: number | null

  current_risk_category: "bajo" | "medio" | "alto" | null
}

export type RiskLevel = "bajo" | "medio" | "alto"

export type InventoryFilters = {
  searchTerm?: string

  hospitalArea?: string

  riskLevel?: RiskLevel | ""
}

export type RiskAssessment = {
  id: number

  methodology_name: string

  methodology_version: string

  function_score: number

  clinical_application_score: number

  maintenance_requirement_score: number

  total_score: number

  category: RiskLevel

  assessed_at: string | null
}

export type EquipmentDocument = {
  id: number

  document_type: "manual_usuario" | "manual_servicio" | "otro"

  title: string | null

  url: string

  review_status: "pendiente" | "confirmado" | "corregido" | "descartado"
}

export type MaintenanceProgram = {
  id: number

  name: string

  procedure_text: string

  interval_months: number | null

  periodicity_basis: string | null

  requires_review: boolean
}

export type InventoryIssue = {
  id: number

  issue_code: string

  severity: "informativo" | "advertencia" | "error"

  field_name: string | null

  source_value: string | null

  details: string

  review_status: "pendiente" | "confirmado" | "corregido" | "descartado"

  resolution_notes?: string | null

  reviewed_at?: string | null
}

export type InventoryIssueReview = {
  id: number
  issue_id: number
  review_status: InventoryIssue["review_status"]
  notes: string
  justification: string
  evidence_reference: string | null
  reviewed_at: string
}

export type InventoryAdminAsset = {
  id: string
  serial_number: string | null
  serial_is_placeholder: boolean
  manufacture_year: number | null
  acquisition_year: number | null
  hospital_area_id: number
  location_id: number | null
  custodian_location_text: string | null
  status: EquipmentStatus
}

export type InventoryAdminOption = {
  id: number
  name: string
  hospital_area_id?: number
}

export type EquipmentProgramConfiguration = {
  maintenance_program_id: number
  interval_months: number | null
  periodicity_basis: string | null
  periodicity_notes: string | null
  reference_date: string | null
  last_completed_on: string | null
  next_due_on: string | null
}

export type InventoryAdministrationData = {
  asset: InventoryAdminAsset
  areas: InventoryAdminOption[]
  locations: InventoryAdminOption[]
  programs: EquipmentProgramConfiguration[]
  issueReviews: InventoryIssueReview[]
  technicians: Profile[]
}

export type EquipmentInventoryBundle = {
  equipment: EquipmentInventoryDetail

  risks: RiskAssessment[]

  documents: EquipmentDocument[]

  programs: MaintenanceProgram[]

  issues: InventoryIssue[]

  restricted: boolean
}

export type InventoryCapabilities = {
  canViewFullDetail: boolean

  canViewRisk: boolean

  canViewDocuments: boolean

  canViewPrograms: boolean

  canViewIssues: boolean
}

export type MaintenanceSummary = {
  id: number

  maintenance_number: string

  maintenance_code: "MP" | "IN" | "MC"

  equipment_identifier: string | null

  equipment_id: string | null

  status: "programado" | "en_proceso" | "completado" | "cancelado"

  scheduled_at: string

  assigned_to: string | null

  priority: "critica" | "alta" | "ordinaria" | null

  completed_at: string | null

  source_report_id: number | null

  validated_by: string | null

  validated_at: string | null

  closure_notes: string | null

  assigned_to_name?: string | null

  equipment?: EquipmentInventoryDetail | null

  report_number?: string | null

  report_status?: string | null

  record?: MaintenanceRecord | null

  activities?: MaintenanceActivity[]

  attachments?: FileAttachment[]
}

export type MaintenanceRecord = {
  id: number
  maintenance_id: number
  performed_by: string
  started_at: string | null
  completed_at: string | null
  diagnosis: string | null
  work_performed: string | null
  test_results: string | null
  equipment_condition: "operativo" | "en_reparacion" | "fuera_de_servicio" | null
  technical_notes: string | null
  updated_at: string
}

export type MaintenanceActivity = {
  id: number
  maintenance_id: number
  activity: string
  completed: boolean
  notes: string | null
}

export type FileAttachment = {
  id: string
  bucket: string
  storage_path: string
  original_name: string
  mime_type: string
  size_bytes: number
  uploaded_by: string
  equipment_id: string | null
  report_id: number | null
  maintenance_id: number | null
  training_id: number | null
  quote_id: number | null
  description: string | null
  created_at: string
}

export type Notification = {
  id: number
  event_type: string
  title: string
  message: string
  entity_type: string | null
  entity_id: string | null
  read_at: string | null
  created_at: string
}

export type InstitutionSettings = {
  id: number
  institution_name: string
  timezone: string
  default_currency: string
  preventive_warning_days: number
  updated_at: string
}

export type MaintenanceCatalogItem = {
  code: "MP" | "IN" | "MC"

  label: string

  description: string
}

export type DashboardData = {
  equipment: EquipmentInventoryDetail[]

  reports: ReportSummary[]

  maintenances: MaintenanceSummary[]
}

export type DocumentLibraryItem = EquipmentDocument & {
  linkedEquipment: number
}

export function getInventoryCapabilities(role: Role): InventoryCapabilities {
  const isBiomedicalStaff = role === "tecnico" || role === "jefe"

  return {
    canViewFullDetail: isBiomedicalStaff,

    canViewRisk: isBiomedicalStaff,

    canViewDocuments: isBiomedicalStaff,

    canViewPrograms: isBiomedicalStaff,

    canViewIssues: role === "jefe",
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const isInventoryAdministrationEnabled =
  import.meta.env.VITE_INVENTORY_ADMIN_ENABLED === "true"

export const isOperationalCompletionEnabled =
  import.meta.env.VITE_OPERATIONAL_COMPLETION_ENABLED === "true"

export const isBusinessCompletionEnabled =
  import.meta.env.VITE_BUSINESS_COMPLETION_ENABLED === "true"

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export function authEmailForInstitutionalId(institutionalId: string) {
  return `${institutionalId}@biomedgest.local`
}

export async function signInWithInstitutionalId(
  institutionalId: string,

  password: string,
) {
  if (!supabase) {
    throw new Error(
      "Supabase no está configurado. Define las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.",
    )
  }

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: authEmailForInstitutionalId(institutionalId),

      password,
    })

  if (authError) throw authError

  const profile = await loadActiveProfile(authData.user.id)

  if (!profile) {
    await supabase.auth.signOut({ scope: "local" })
    throw new Error("Tu perfil está inactivo o no está autorizado para usar BioMedGest.")
  }

  return profile
}

export async function loadActiveProfile(
  userId: string,
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient
    .from("profiles")
    .select("id, institutional_id, full_name, role, department, active, must_change_password")
    .eq("id", userId)
    .eq("active", true)
    .maybeSingle<Profile>()

  if (error) throw error
  return data
}

export async function getCurrentProfile() {
  if (!supabase) return null

  const { data: sessionData } = await supabase.auth.getSession()

  if (!sessionData.session) return null

  const profile = await loadActiveProfile(sessionData.session.user.id)
  if (!profile) {
    await supabase.auth.signOut({ scope: "local" })
    return null
  }
  return profile
}

export type CreateReportInput = {
  equipmentId: string | null

  equipmentIdentifier: string

  eventDate: string

  eventType: string

  service: string

  location: string

  manufacturer: string

  modelSerial: string

  description: string

  patientOutcome: string

  actionTaken: string
}

export async function createReport(
  input: CreateReportInput,
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  if (!input.equipmentId) {
    throw new Error("Selecciona explícitamente un equipo registrado.")
  }

  const { data, error } = await configuredClient

    .from("reports")

    .insert({
      equipment_id: input.equipmentId,

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

    .single<{ report_number: string }>()

  if (error) throw error

  return data.report_number
}

export type ReportSummary = {
  id: number

  report_number: string

  reporter_id: string

  equipment_id: string | null

  maintenance_id: number | null

  equipment_identifier: string

  description: string

  service: string

  priority: string

  status: string

  created_at: string

  event_date: string

  event_type: string

  location: string | null

  manufacturer: string | null

  model_serial: string | null

  patient_outcome: string | null

  action_taken: string | null
}

const reportSummarySelection =
  "id, report_number, reporter_id, equipment_id, maintenance_id, equipment_identifier, description, service, priority, status, created_at, event_date, event_type, location, manufacturer, model_serial, patient_outcome, action_taken"

export async function listReports(client: SupabaseClient | null = supabase) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient

    .from("reports")

    .select(reportSummarySelection)

    .order("created_at", { ascending: false })

  if (error) throw error

  return data as ReportSummary[]
}

export async function updateReportWorkflow(
  reportNumber: string,
  changes: Pick<ReportSummary, "priority" | "status">,
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient
    .from("reports")
    .update(changes)
    .eq("report_number", reportNumber)
    .select(reportSummarySelection)
    .single<ReportSummary>()
  if (error) throw error
  return data
}

export async function listActiveTechnicians(
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient
    .from("profiles")
    .select("id, institutional_id, full_name, role, department, active, must_change_password")
    .eq("role", "tecnico")
    .eq("active", true)
    .order("full_name")
  if (error) throw error
  return (data || []) as Profile[]
}

export async function createCorrectiveOrderFromReport(
  reportId: number,
  assignedTo: string,
  priority: "critica" | "alta" | "ordinaria",
  scheduledAt: string,
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.rpc(
    "create_corrective_order_from_report",
    {
      target_report_id: reportId,
      target_assigned_to: assignedTo,
      target_priority: priority,
      target_scheduled_at: scheduledAt,
    },
  )
  if (error) throw error
  return data as MaintenanceSummary
}

export async function loadDashboardData(role: Role): Promise<DashboardData> {
  const configuredClient = requireSupabase()

  const reportQuery = configuredClient

    .from("reports")

    .select(
      reportSummarySelection,
    )

    .order("created_at", { ascending: false })

  const maintenanceQuery = configuredClient

    .from("maintenances")

    .select(
      "id, maintenance_number, maintenance_code, equipment_identifier, equipment_id, status, scheduled_at, assigned_to, priority, completed_at",
    )

    .order("scheduled_at", { ascending: true })

  const [reportResult, maintenanceResult, equipment] = await Promise.all([
    reportQuery,

    maintenanceQuery,

    role === "jefe"
      ? listEquipmentInventory("jefe", {}, configuredClient)
      : Promise.resolve([]),
  ])

  if (reportResult.error) throw reportResult.error

  if (maintenanceResult.error) throw maintenanceResult.error

  return {
    equipment,

    reports: (reportResult.data || []) as ReportSummary[],

    maintenances: (maintenanceResult.data || []) as MaintenanceSummary[],
  }
}

export async function listMaintenanceOverview(
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)

  const activityQuery = isOperationalCompletionEnabled
    ? configuredClient
        .from("maintenance_activities")
        .select("id, maintenance_id, activity, completed, notes")
    : Promise.resolve({ data: [] as MaintenanceActivity[], error: null })

  const attachmentQuery = isOperationalCompletionEnabled
    ? configuredClient
        .from("file_attachments")
        .select("id, bucket, storage_path, original_name, mime_type, size_bytes, uploaded_by, equipment_id, report_id, maintenance_id, training_id, quote_id, description, created_at")
        .not("maintenance_id", "is", null)
    : Promise.resolve({ data: [] as FileAttachment[], error: null })

  const [catalogResult, maintenanceResult, recordResult, reportResult, profileResult, equipmentResult, activityResult, attachmentResult] = await Promise.all([
    configuredClient

      .from("maintenance_catalog")

      .select("code, label, description")

      .order("code"),

    configuredClient

      .from("maintenances")

      .select(
        "id, maintenance_number, maintenance_code, equipment_identifier, equipment_id, status, scheduled_at, assigned_to, priority, completed_at, source_report_id, validated_by, validated_at, closure_notes",
      )

      .order("scheduled_at", { ascending: true }),

    configuredClient
      .from("maintenance_records")
      .select("id, maintenance_id, performed_by, started_at, completed_at, diagnosis, work_performed, test_results, equipment_condition, technical_notes, updated_at"),

    configuredClient
      .from("reports")
      .select("id, report_number, maintenance_id, status"),

    configuredClient
      .from("profiles")
      .select("id, full_name")
      .eq("active", true),

    configuredClient
      .from("equipment_inventory_detail")
      .select("id, inventory_code, equipment_type, manufacturer, model, serial_number, manufacture_year, acquisition_year, hospital_area, location, custodian_location_text, status, requires_review, current_risk_score, current_risk_category"),

    activityQuery,

    attachmentQuery,
  ])

  if (catalogResult.error) throw catalogResult.error

  if (maintenanceResult.error) throw maintenanceResult.error

  if (recordResult.error) throw recordResult.error

  if (reportResult.error) throw reportResult.error

  if (profileResult.error) throw profileResult.error

  if (equipmentResult.error) throw equipmentResult.error

  if (activityResult.error) throw activityResult.error

  if (attachmentResult.error) throw attachmentResult.error

  const records = new Map(
    ((recordResult.data || []) as MaintenanceRecord[]).map((record) => [record.maintenance_id, record]),
  )
  const reports = new Map(
    (reportResult.data || []).map((report) => [report.maintenance_id as number, report]),
  )
  const profiles = new Map(
    (profileResult.data || []).map((profile) => [profile.id, profile.full_name]),
  )
  const equipment = new Map(
    ((equipmentResult.data || []) as EquipmentInventoryDetail[]).map((item) => [item.id, item]),
  )
  const activities = new Map<number, MaintenanceActivity[]>()
  for (const activity of (activityResult.data || []) as MaintenanceActivity[]) {
    activities.set(activity.maintenance_id, [...(activities.get(activity.maintenance_id) || []), activity])
  }
  const attachments = new Map<number, FileAttachment[]>()
  for (const attachment of (attachmentResult.data || []) as FileAttachment[]) {
    if (attachment.maintenance_id)
      attachments.set(attachment.maintenance_id, [...(attachments.get(attachment.maintenance_id) || []), attachment])
  }

  return {
    catalog: (catalogResult.data || []) as MaintenanceCatalogItem[],

    maintenances: (maintenanceResult.data || []).map((maintenance) => {
      const report = reports.get(maintenance.id)
      return {
        ...maintenance,
        record: records.get(maintenance.id) || null,
        report_number: report?.report_number || null,
        report_status: report?.status || null,
        assigned_to_name: maintenance.assigned_to ? profiles.get(maintenance.assigned_to) || null : null,
        equipment: maintenance.equipment_id ? equipment.get(maintenance.equipment_id) || null : null,
        activities: activities.get(maintenance.id) || [],
        attachments: attachments.get(maintenance.id) || [],
      } as MaintenanceSummary
    }),
  }
}

export type SaveCorrectiveInterventionInput = {
  startedAt: string
  completedAt: string | null
  diagnosis: string
  workPerformed: string
  testResults: string
  equipmentCondition: MaintenanceRecord["equipment_condition"]
  technicalNotes: string
}

export async function saveCorrectiveIntervention(
  maintenanceId: number,
  input: SaveCorrectiveInterventionInput,
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.rpc(
    "save_corrective_intervention",
    {
      target_maintenance_id: maintenanceId,
      new_started_at: input.startedAt,
      new_completed_at: input.completedAt,
      new_diagnosis: input.diagnosis,
      new_work_performed: input.workPerformed,
      new_test_results: input.testResults,
      new_equipment_condition: input.equipmentCondition,
      new_technical_notes: input.technicalNotes,
    },
  )
  if (error) throw error
  return data as MaintenanceRecord
}

export async function validateCorrectiveClosure(
  maintenanceId: number,
  notes: string,
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.rpc(
    "validate_corrective_closure",
    { target_maintenance_id: maintenanceId, validation_notes: notes },
  )
  if (error) throw error
  return data as MaintenanceSummary
}

export async function updateAssignedMaintenanceStatus(
  maintenanceId: number,
  status: MaintenanceSummary["status"],
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.rpc(
    "update_assigned_maintenance_status",
    { target_maintenance_id: maintenanceId, new_status: status },
  )
  if (error) throw error
  return data as MaintenanceSummary
}

export async function listDocumentLibrary() {
  const configuredClient = requireSupabase()

  const { data, error } = await configuredClient

    .from("equipment_documents")

    .select(
      "id, document_type, title, url, review_status, equipment_document_links(count)",
    )

    .order("title", { ascending: true, nullsFirst: false })

  if (error) throw error

  return (data || []).map((row) => {
    const relation = row.equipment_document_links as unknown as {
      count: number
    }[] | null

    return {
      id: row.id,

      document_type: row.document_type,

      title: row.title,

      url: row.url,

      review_status: row.review_status,

      linkedEquipment: relation?.[0]?.count ?? 0,
    } as DocumentLibraryItem
  })
}

export async function listTrainings() {
  if (!supabase) throw new Error("Supabase no está configurado.")

  const { data, error } = await supabase
    .from("trainings")
    .select(
      `id, training_number, title, purpose, recurrence, scheduled_at, location, description, status, instructor_id${isBusinessCompletionEnabled ? ", equipment_id" : ""}`,
    )
    .order("scheduled_at")

  if (error) throw error

  const labels: Record<string, string> = {
    equipo_nuevo: "Equipo nuevo",
    personal_nuevo: "Personal nuevo",
    necesidad_detectada: "Necesidad detectada",
    protocolo: "Protocolo",
  }

  const trainingRows = (data || []) as unknown as Array<Omit<Training, "purposeLabel">>
  return trainingRows.map((training) => ({
    ...training,
    purposeLabel: labels[training.purpose] || training.purpose,
  })) as Training[]
}

export async function createTraining(input: {
  title: string
  purpose: string
  recurrence: string
  scheduledAt: string
  location: string
  description: string
  equipmentId?: string
}) {
  if (!supabase) throw new Error("Supabase no está configurado.")

  const { data: session } = await supabase.auth.getSession()

  if (!session.session?.user.id) throw new Error("La sesión expiró.")

  const { data, error } = await supabase
    .from("trainings")
    .insert({
      title: input.title,

      purpose: input.purpose,

      recurrence: input.recurrence,

      scheduled_at: input.scheduledAt,

      location: input.location || null,

      description: input.description || null,

      ...(isBusinessCompletionEnabled ? { equipment_id: input.equipmentId || null } : {}),

      instructor_id: session.session.user.id,
    })
    .select(
      `id, training_number, title, purpose, recurrence, scheduled_at, location, description, status, instructor_id${isBusinessCompletionEnabled ? ", equipment_id" : ""}`,
    )
    .single()

  if (error) throw error

  const labels: Record<string, string> = {
    equipo_nuevo: "Equipo nuevo",
    personal_nuevo: "Personal nuevo",
    necesidad_detectada: "Necesidad detectada",
    protocolo: "Protocolo",
  }

  const training = data as unknown as Omit<Training, "purposeLabel">
  return {
    ...training,
    purposeLabel: labels[training.purpose] || training.purpose,
  } as Training
}

export async function listProfiles() {
  if (!supabase) throw new Error("Supabase no está configurado.")

  const { data, error } = await supabase
    .from("profiles")
    .select("id, institutional_id, full_name, role, department, active, must_change_password")
    .order("institutional_id")

  if (error) throw error

  return (data || []) as Profile[]
}

export async function listAuditLog() {
  if (!supabase) throw new Error("Supabase no está configurado.")

  const { data, error } = await supabase
    .from("audit_log")
    .select("id, action, entity_type, entity_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) throw error

  return (data || []) as AuditEntry[]
}

export async function listProfileChangeHistory(client: SupabaseClient | null = supabase) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.from("profile_change_history")
    .select("id, profile_id, changed_by, previous_role, new_role, previous_active, new_active, reason, changed_at")
    .order("changed_at", { ascending: false }).limit(100)
  if (error) throw error
  return (data || []) as ProfileChange[]
}

export async function listQuotes() {
  if (!supabase) throw new Error("Supabase no está configurado.")

  const { data, error } = await supabase
    .from("quotes")
    .select(
      "id, quote_number, supplier, equipment_description, amount, currency, status, notes, created_at, equipment_id, maintenance_id",
    )
    .order("created_at", { ascending: false })

  if (error) throw error

  return (data || []) as Quote[]
}

export async function createQuote(input: {
  supplier: string
  equipmentDescription: string
  amount: number
  notes: string
}) {
  if (!supabase) throw new Error("Supabase no está configurado.")

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      supplier: input.supplier,
      equipment_description: input.equipmentDescription,
      amount: input.amount,
      notes: input.notes || null,
    })
    .select(
      "id, quote_number, supplier, equipment_description, amount, currency, status, notes, created_at, equipment_id, maintenance_id",
    )
    .single()

  if (error) throw error

  return data as Quote
}

export async function listTrainingParticipants(
  trainingId: number,
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient
    .from("training_participants")
    .select("training_id, participant_id, attendance_status, profile:profiles!training_participants_participant_id_fkey(full_name, institutional_id, role)")
    .eq("training_id", trainingId)
    .order("participant_id")
  if (error) throw error
  return (data || []).map((row) => ({ ...row, profile: Array.isArray(row.profile) ? row.profile[0] : row.profile })) as TrainingParticipant[]
}

export async function setTrainingParticipants(
  trainingId: number,
  participantIds: string[],
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.rpc("set_training_participants", { target_training_id: trainingId, participant_ids: participantIds })
  if (error) throw error
  return (data || []) as TrainingParticipant[]
}

export async function listActiveProfileDirectory(client: SupabaseClient | null = supabase) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.rpc("list_active_profile_directory")
  if (error) throw error
  return (data || []) as Profile[]
}

export async function updateTrainingAttendance(
  trainingId: number,
  participantId: string,
  status: TrainingParticipant["attendance_status"],
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.rpc("update_training_participant_attendance", { target_training_id: trainingId, target_participant_id: participantId, new_status: status })
  if (error) throw error
  return data as TrainingParticipant
}

export async function updateTrainingStatus(
  trainingId: number,
  status: Training["status"],
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.rpc("update_training_status", { target_training_id: trainingId, new_status: status })
  if (error) throw error
  return data as Training
}

export async function listQuoteItems(quoteId: number, client: SupabaseClient | null = supabase) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.from("quote_items").select("id, quote_id, description, quantity, unit_cost, line_total").eq("quote_id", quoteId).order("id")
  if (error) throw error
  return (data || []) as QuoteItem[]
}

export async function saveQuoteItems(
  quoteId: number,
  status: Quote["status"],
  items: QuoteItem[],
  relation: { equipmentId?: string | null; maintenanceId?: number | null } = {},
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.rpc("save_quote_items", {
    target_quote_id: quoteId, new_status: status,
    items: items.map(({ description, quantity, unit_cost }) => ({ description, quantity, unit_cost })),
    target_equipment_id: relation.equipmentId || null,
    target_maintenance_id: relation.maintenanceId || null,
  })
  if (error) throw error
  return data as Quote
}

export async function createAccessRequest(input: {
  institutionalId: string
  fullName: string
  role: Role
  department: string
}) {
  if (!supabase) throw new Error("Supabase no está configurado.")

  const { error } = await supabase
    .from("user_access_requests")
    .insert({
      institutional_id: input.institutionalId,
      full_name: input.fullName,
      role: input.role,
      department: input.department || null,
    })

  if (error) throw error
}

export async function listAccessRequests(client: SupabaseClient | null = supabase) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.from("user_access_requests")
    .select("id, institutional_id, full_name, role, department, status, created_at")
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data || []) as AccessRequest[]
}

function requireSupabase(client: SupabaseClient | null = supabase) {
  if (!client) {
    throw new Error(
      "Supabase no está configurado. Agrega las variables públicas en .env.local.",
    )
  }

  return client
}

export async function searchEquipmentDirectory(
  searchTerm = "",

  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)

  const { data, error } = await configuredClient.rpc(
    "search_equipment_directory",
    {
      search_term: searchTerm.trim() || null,
    },
  )

  if (error) throw error

  return (data || []) as EquipmentDirectoryItem[]
}

export async function listEquipmentInventory(
  role: Role,

  filters: InventoryFilters = {},

  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)

  if (role === "usuario") {
    const directory = await searchEquipmentDirectory(
      filters.searchTerm,
      configuredClient,
    )

    return directory

      .filter(
        (item) =>
          !filters.hospitalArea || item.hospital_area === filters.hospitalArea,
      )

      .map<EquipmentInventoryDetail>((item) => ({
        ...item,

        serial_number: null,

        manufacture_year: null,

        acquisition_year: null,

        custodian_location_text: null,

        requires_review: false,

        current_risk_score: null,

        current_risk_category: null,
      }))
  }

  const { data, error } = await configuredClient.rpc(
    "search_equipment_inventory",
    {
      search_term: filters.searchTerm?.trim() || null,

      area_filter: filters.hospitalArea?.trim() || null,

      risk_filter: filters.riskLevel || null,
    },
  )

  if (error) throw error

  return (data || []) as EquipmentInventoryDetail[]
}

export async function getEquipmentInventoryDetail(
  equipmentId: string,

  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)

  const { data, error } = await configuredClient

    .from("equipment_inventory_detail")

    .select(
      "id, inventory_code, equipment_type, manufacturer, model, serial_number, manufacture_year, acquisition_year, hospital_area, location, custodian_location_text, status, requires_review, current_risk_score, current_risk_category",
    )

    .eq("id", equipmentId)

    .maybeSingle()

  if (error) throw error

  if (!data)
    throw new Error(
      "Equipo no encontrado o sin permisos para consultar su ficha.",
    )

  return data as EquipmentInventoryDetail
}

function unwrapRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function getEquipmentInventoryBundle(
  equipmentId: string,

  role: Role,

  client: SupabaseClient | null = supabase,
): Promise<EquipmentInventoryBundle> {
  const configuredClient = requireSupabase(client)

  const capabilities = getInventoryCapabilities(role)

  if (!capabilities.canViewFullDetail) {
    const directory = await searchEquipmentDirectory("", configuredClient)

    const item = directory.find((candidate) => candidate.id === equipmentId)

    if (!item)
      throw new Error("Equipo no encontrado o sin permisos para consultarlo.")

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
    }
  }

  const equipment = await getEquipmentInventoryDetail(
    equipmentId,
    configuredClient,
  )

  const [riskResult, documentResult, programResult] = await Promise.all([
    configuredClient

      .from("risk_assessments")

      .select(
        "id, methodology_name, methodology_version, function_score, clinical_application_score, maintenance_requirement_score, total_score, category, assessed_at",
      )

      .eq("equipment_id", equipmentId)

      .order("created_at", { ascending: false }),

    configuredClient

      .from("equipment_document_links")

      .select(
        "equipment_documents(id, document_type, title, url, review_status)",
      )

      .eq("equipment_id", equipmentId),

    configuredClient

      .from("equipment_maintenance_programs")

      .select(
        "maintenance_programs(id, name, procedure_text, interval_months, periodicity_basis, requires_review)",
      )

      .eq("equipment_id", equipmentId),
  ])

  if (riskResult.error) throw riskResult.error

  if (documentResult.error) throw documentResult.error

  if (programResult.error) throw programResult.error

  let issues: InventoryIssue[] = []

  if (capabilities.canViewIssues) {
    const issueResult = await configuredClient

      .from("inventory_import_issues")

      .select(
        "id, issue_code, severity, field_name, source_value, details, review_status, resolution_notes, reviewed_at",
      )

      .eq("equipment_id", equipmentId)

      .order("severity", { ascending: false })

    if (issueResult.error) throw issueResult.error

    issues = ((issueResult.data || []) as InventoryIssue[])
  }

  const documents = (documentResult.data || [])

    .map((row) =>
      unwrapRelation(
        row.equipment_documents as EquipmentDocument | EquipmentDocument[] | null,
      ),
    )

    .filter((document): document is EquipmentDocument => Boolean(document))

  const programs = (programResult.data || [])

    .map((row) =>
      unwrapRelation(
        row.maintenance_programs as MaintenanceProgram | MaintenanceProgram[] | null,
      ),
    )

    .filter((program): program is MaintenanceProgram => Boolean(program))

  return {
    equipment,

    risks: (riskResult.data || []) as RiskAssessment[],

    documents,

    programs,

    issues,

    restricted: false,
  }
}

export async function getInventoryAdministrationData(
  equipmentId: string,
  client: SupabaseClient | null = supabase,
): Promise<InventoryAdministrationData> {
  const configuredClient = requireSupabase(client)
  const [assetResult, areasResult, locationsResult, programsResult, reviewsResult, techniciansResult] = await Promise.all([
    configuredClient
      .from("equipment_assets")
      .select("id, serial_number, serial_is_placeholder, manufacture_year, acquisition_year, hospital_area_id, location_id, custodian_location_text, status")
      .eq("id", equipmentId)
      .single(),
    configuredClient.from("hospital_areas").select("id, name").eq("active", true).order("name"),
    configuredClient.from("equipment_locations").select("id, name, hospital_area_id").eq("active", true).order("name"),
    configuredClient
      .from("equipment_maintenance_programs")
      .select("maintenance_program_id, interval_months, periodicity_basis, periodicity_notes, reference_date, last_completed_on, next_due_on")
      .eq("equipment_id", equipmentId),
    configuredClient
      .from("inventory_issue_reviews")
      .select("id, issue_id, review_status, notes, justification, evidence_reference, reviewed_at, inventory_import_issues!inner(equipment_id)")
      .eq("inventory_import_issues.equipment_id", equipmentId)
      .order("reviewed_at", { ascending: false }),
    configuredClient
      .from("profiles")
      .select("id, institutional_id, full_name, role, department, active, must_change_password")
      .eq("role", "tecnico")
      .eq("active", true)
      .order("full_name"),
  ])

  const failed = [assetResult, areasResult, locationsResult, programsResult, reviewsResult, techniciansResult]
    .find((result) => result.error)
  if (failed?.error) throw failed.error

  return {
    asset: assetResult.data as InventoryAdminAsset,
    areas: (areasResult.data || []) as InventoryAdminOption[],
    locations: (locationsResult.data || []) as InventoryAdminOption[],
    programs: (programsResult.data || []) as EquipmentProgramConfiguration[],
    issueReviews: (reviewsResult.data || []) as InventoryIssueReview[],
    technicians: (techniciansResult.data || []) as Profile[],
  }
}

export async function updateEquipmentAssetAdmin(
  asset: InventoryAdminAsset,
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.rpc("update_equipment_asset_admin", {
    target_equipment_id: asset.id,
    new_serial_number: asset.serial_number,
    new_serial_is_placeholder: asset.serial_is_placeholder,
    new_manufacture_year: asset.manufacture_year,
    new_acquisition_year: asset.acquisition_year,
    new_hospital_area_id: asset.hospital_area_id,
    new_location_id: asset.location_id,
    new_custodian_location_text: asset.custodian_location_text,
    new_status: asset.status,
  })
  if (error) throw error
  return data as InventoryAdminAsset
}

export async function configureEquipmentPreventiveProgram(
  equipmentId: string,
  configuration: EquipmentProgramConfiguration,
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.rpc("configure_equipment_preventive_program", {
    target_equipment_id: equipmentId,
    target_program_id: configuration.maintenance_program_id,
    new_interval_months: configuration.interval_months,
    new_periodicity_basis: configuration.periodicity_basis,
    new_periodicity_notes: configuration.periodicity_notes,
    new_reference_date: configuration.reference_date,
    new_last_completed_on: configuration.last_completed_on,
  })
  if (error) throw error
  return data as EquipmentProgramConfiguration
}

export async function schedulePreventiveMaintenance(
  input: {
    equipmentId: string
    programId: number
    scheduledAt: string
    assignedTo: string | null
    priority: "critica" | "alta" | "ordinaria"
  },
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.rpc("schedule_preventive_maintenance", {
    target_equipment_id: input.equipmentId,
    target_program_id: input.programId,
    target_scheduled_at: input.scheduledAt,
    target_assigned_to: input.assignedTo,
    target_priority: input.priority,
  })
  if (error) throw error
  return data as MaintenanceSummary
}

export async function reviewInventoryIssue(
  input: {
    issueId: number
    status: Exclude<InventoryIssue["review_status"], "pendiente">
    notes: string
    justification: string
    evidenceReference: string | null
  },
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.rpc("review_inventory_issue", {
    target_issue_id: input.issueId,
    new_review_status: input.status,
    review_notes: input.notes,
    review_justification: input.justification,
    review_evidence_reference: input.evidenceReference,
  })
  if (error) throw error
  return data as InventoryIssue
}

export type PreventiveActivityInput = {
  activity: string
  completed: boolean
  notes: string
}

export async function savePreventiveIntervention(
  maintenanceId: number,
  input: SaveCorrectiveInterventionInput & { activities: PreventiveActivityInput[] },
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.rpc("save_preventive_intervention", {
    target_maintenance_id: maintenanceId,
    new_started_at: input.startedAt,
    new_completed_at: input.completedAt,
    new_diagnosis: input.diagnosis,
    new_work_performed: input.workPerformed,
    new_test_results: input.testResults,
    new_equipment_condition: input.equipmentCondition,
    new_technical_notes: input.technicalNotes,
    new_activities: input.activities,
  })
  if (error) throw error
  return data as MaintenanceRecord
}

export async function validatePreventiveClosure(
  maintenanceId: number,
  notes: string,
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.rpc("validate_preventive_closure", {
    target_maintenance_id: maintenanceId,
    validation_notes: notes,
  })
  if (error) throw error
  return data as MaintenanceSummary
}

export async function listNotifications(
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { error: refreshError } = await configuredClient.rpc("refresh_my_preventive_notifications")
  if (refreshError) throw refreshError
  const { data, error } = await configuredClient
    .from("notifications")
    .select("id, event_type, title, message, entity_type, entity_id, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) throw error
  return (data || []) as Notification[]
}

export async function markNotificationRead(
  notificationId: number,
  read = true,
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.rpc("mark_notification_read", {
    target_notification_id: notificationId,
    mark_read: read,
  })
  if (error) throw error
  return data as Notification
}

export async function manageProfile(
  profile: Profile,
  reason: string,
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.rpc("manage_profile", {
    target_profile_id: profile.id,
    new_full_name: profile.full_name,
    new_department: profile.department,
    new_role: profile.role,
    new_active: profile.active,
    change_reason: reason,
  })
  if (error) throw error
  return data as Profile
}

export async function updateOwnProfile(
  fullName: string,
  department: string,
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.rpc("update_own_profile", {
    new_full_name: fullName,
    new_department: department,
  })
  if (error) throw error
  return data as Profile
}

export async function getInstitutionSettings(
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient
    .from("institution_settings")
    .select("id, institution_name, timezone, default_currency, preventive_warning_days, updated_at")
    .single()
  if (error) throw error
  return data as InstitutionSettings
}

export async function updateInstitutionSettings(
  settings: InstitutionSettings,
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.rpc("update_institution_settings", {
    new_institution_name: settings.institution_name,
    new_timezone: settings.timezone,
    new_default_currency: settings.default_currency,
    new_preventive_warning_days: settings.preventive_warning_days,
  })
  if (error) throw error
  return data as InstitutionSettings
}

export type AttachmentRelation =
  | { equipmentId: string }
  | { reportId: number }
  | { maintenanceId: number }
  | { trainingId: number }
  | { quoteId: number }

const allowedAttachmentTypes = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])

export async function listPrivateAttachments(
  relation: AttachmentRelation,
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const relationEntry = Object.entries(relation)[0]
  const column = `${relationEntry[0].replace(/Id$/, "")}_id`
  const { data, error } = await configuredClient
    .from("file_attachments")
    .select("id, bucket, storage_path, original_name, mime_type, size_bytes, uploaded_by, equipment_id, report_id, maintenance_id, training_id, quote_id, description, created_at")
    .eq(column, relationEntry[1])
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data || []) as FileAttachment[]
}

export async function getReportIdByNumber(
  reportNumber: string,
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.from("reports").select("id").eq("report_number", reportNumber).single()
  if (error) throw error
  return Number(data.id)
}

export async function uploadPrivateAttachment(
  file: File,
  relation: AttachmentRelation,
  description: string,
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  if (!allowedAttachmentTypes.has(file.type)) throw new Error("Tipo de archivo no permitido.")
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error("El archivo debe medir entre 1 byte y 10 MB.")
  const { data: sessionResult } = await configuredClient.auth.getSession()
  const userId = sessionResult.session?.user.id
  if (!userId) throw new Error("La sesión expiró.")
  const relationEntry = Object.entries(relation)[0]
  const relationName = relationEntry[0].replace(/Id$/, "")
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120)
  const storagePath = `${userId}/${relationName}/${relationEntry[1]}/${crypto.randomUUID()}-${safeName}`
  const { error: uploadError } = await configuredClient.storage
    .from("biomedgest-private")
    .upload(storagePath, file, { contentType: file.type, upsert: false })
  if (uploadError) throw uploadError

  const relationColumns = {
    equipment_id: "equipmentId" in relation ? relation.equipmentId : null,
    report_id: "reportId" in relation ? relation.reportId : null,
    maintenance_id: "maintenanceId" in relation ? relation.maintenanceId : null,
    training_id: "trainingId" in relation ? relation.trainingId : null,
    quote_id: "quoteId" in relation ? relation.quoteId : null,
  }
  const { data, error } = await configuredClient
    .from("file_attachments")
    .insert({
      bucket: "biomedgest-private",
      storage_path: storagePath,
      original_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      description: description || null,
      ...relationColumns,
    })
    .select("id, bucket, storage_path, original_name, mime_type, size_bytes, uploaded_by, equipment_id, report_id, maintenance_id, training_id, quote_id, description, created_at")
    .single()
  if (error) {
    await configuredClient.storage.from("biomedgest-private").remove([storagePath])
    throw error
  }
  return data as FileAttachment
}

export async function createAttachmentDownloadUrl(
  attachment: FileAttachment,
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.storage
    .from(attachment.bucket)
    .createSignedUrl(attachment.storage_path, 60)
  if (error) throw error
  return data.signedUrl
}

export async function deletePrivateAttachment(
  attachmentId: string,
  client: SupabaseClient | null = supabase,
) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.functions.invoke("storage-admin", {
    body: { action: "delete", attachmentId },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as { deleted: boolean; id: string }
}

export async function checkStorageIntegrity(client: SupabaseClient | null = supabase) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.functions.invoke("storage-admin", { body: { action: "integrity" } })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as { missingObjects: Array<{ id: string; storage_path: string }>; orphanObjects: string[] }
}

export async function provisionUser(input: {
  institutionalId: string; fullName: string; role: Role; department: string;
  temporaryPassword: string; accessRequestId?: number
}, client: SupabaseClient | null = supabase) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.functions.invoke("admin-users", { body: { action: "provision", ...input } })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as { id: string; institutionalId: string; mustChangePassword: boolean }
}

export async function syncAuthStatus(profileId: string, active: boolean, client: SupabaseClient | null = supabase) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.functions.invoke("admin-users", { body: { action: "set-auth-status", profileId, active } })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as { id: string; active: boolean }
}

export async function changeOwnPassword(password: string, client: SupabaseClient | null = supabase) {
  const configuredClient = requireSupabase(client)
  if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password))
    throw new Error("La contraseña debe tener al menos 12 caracteres, mayúscula, minúscula y número.")
  const { error: authError } = await configuredClient.auth.updateUser({ password })
  if (authError) throw authError
  const { data, error } = await configuredClient.rpc("complete_password_change")
  if (error) throw error
  return data as Profile
}

export type ActivityTimelineEntry = { event_time: string; event_type: string; reference: string; description: string }

export async function getProfileActivity(profileId?: string, client: SupabaseClient | null = supabase) {
  const configuredClient = requireSupabase(client)
  const { data, error } = profileId
    ? await configuredClient.rpc("get_profile_activity", { target_profile_id: profileId })
    : await configuredClient.rpc("get_profile_activity")
  if (error) throw error
  return (data || []) as ActivityTimelineEntry[]
}

export async function getEquipmentActivity(equipmentId: string, client: SupabaseClient | null = supabase) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.rpc("get_equipment_activity", { target_equipment_id: equipmentId })
  if (error) throw error
  return (data || []) as ActivityTimelineEntry[]
}

export type QuoteStatusHistory = { id: number; quote_id: number; previous_status: string; new_status: string; changed_by: string; changed_at: string }
export async function listQuoteStatusHistory(quoteId: number, client: SupabaseClient | null = supabase) {
  const configuredClient = requireSupabase(client)
  const { data, error } = await configuredClient.from("quote_status_history")
    .select("id, quote_id, previous_status, new_status, changed_by, changed_at")
    .eq("quote_id", quoteId).order("changed_at", { ascending: false })
  if (error) throw error
  return (data || []) as QuoteStatusHistory[]
}
