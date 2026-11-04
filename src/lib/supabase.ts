import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export type Role = "jefe" | "tecnico" | "usuario"

export type Profile = {
  id: string

  institutional_id: string

  full_name: string

  role: Role

  department: string | null
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
}

export type AuditEntry = {
  id: number

  action: string

  entity_type: string

  entity_id: string | null

  created_at: string
}

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
}

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

  const { data: profile, error: profileError } = await supabase

    .from("profiles")

    .select("id, institutional_id, full_name, role, department")

    .eq("id", authData.user.id)

    .single<Profile>()

  if (profileError) {
    await supabase.auth.signOut()

    throw profileError
  }

  return profile
}

export async function getCurrentProfile() {
  if (!supabase) return null

  const { data: sessionData } = await supabase.auth.getSession()

  if (!sessionData.session) return null

  const { data, error } = await supabase

    .from("profiles")

    .select("id, institutional_id, full_name, role, department")

    .eq("id", sessionData.session.user.id)

    .single<Profile>()

  if (error) throw error

  return data
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
  report_number: string

  equipment_identifier: string

  description: string

  service: string

  priority: string

  status: string

  created_at: string
}

export async function listReports() {
  if (!supabase) {
    throw new Error("Supabase no está configurado.")
  }

  const { data, error } = await supabase

    .from("reports")

    .select(
      "report_number, equipment_identifier, description, service, priority, status, created_at",
    )

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
    .select("report_number, equipment_identifier, description, service, priority, status, created_at")
    .single<ReportSummary>()
  if (error) throw error
  return data
}

export async function loadDashboardData(role: Role): Promise<DashboardData> {
  const configuredClient = requireSupabase()

  const reportQuery = configuredClient

    .from("reports")

    .select(
      "report_number, equipment_identifier, description, service, priority, status, created_at",
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

export async function listMaintenanceOverview() {
  const configuredClient = requireSupabase()

  const [catalogResult, maintenanceResult] = await Promise.all([
    configuredClient

      .from("maintenance_catalog")

      .select("code, label, description")

      .order("code"),

    configuredClient

      .from("maintenances")

      .select(
        "id, maintenance_number, maintenance_code, equipment_identifier, equipment_id, status, scheduled_at, assigned_to, priority, completed_at",
      )

      .order("scheduled_at", { ascending: true }),
  ])

  if (catalogResult.error) throw catalogResult.error

  if (maintenanceResult.error) throw maintenanceResult.error

  return {
    catalog: (catalogResult.data || []) as MaintenanceCatalogItem[],

    maintenances: (maintenanceResult.data || []) as MaintenanceSummary[],
  }
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
      "id, training_number, title, purpose, recurrence, scheduled_at, location, description",
    )
    .order("scheduled_at")

  if (error) throw error

  const labels: Record<string, string> = {
    equipo_nuevo: "Equipo nuevo",
    personal_nuevo: "Personal nuevo",
    necesidad_detectada: "Necesidad detectada",
    protocolo: "Protocolo",
  }

  return (data || []).map((training) => ({
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

      instructor_id: session.session.user.id,
    })
    .select(
      "id, training_number, title, purpose, recurrence, scheduled_at, location, description",
    )
    .single()

  if (error) throw error

  const labels: Record<string, string> = {
    equipo_nuevo: "Equipo nuevo",
    personal_nuevo: "Personal nuevo",
    necesidad_detectada: "Necesidad detectada",
    protocolo: "Protocolo",
  }

  return {
    ...data,
    purposeLabel: labels[data.purpose] || data.purpose,
  } as Training
}

export async function listProfiles() {
  if (!supabase) throw new Error("Supabase no está configurado.")

  const { data, error } = await supabase
    .from("profiles")
    .select("id, institutional_id, full_name, role, department")
    .eq("active", true)
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

export async function listQuotes() {
  if (!supabase) throw new Error("Supabase no está configurado.")

  const { data, error } = await supabase
    .from("quotes")
    .select(
      "id, quote_number, supplier, equipment_description, amount, currency, status, notes, created_at",
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
      "id, quote_number, supplier, equipment_description, amount, currency, status, notes, created_at",
    )
    .single()

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
      .select("id, institutional_id, full_name, role, department")
      .eq("role", "tecnico")
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
