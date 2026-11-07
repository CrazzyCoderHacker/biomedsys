import { useEffect, useMemo, useState } from "react"

import {
  createCorrectiveOrderFromReport,
  createReport,
  getCurrentProfile,
  getReportIdByNumber,
  isOperationalCompletionEnabled,
  isSupabaseConfigured,
  listActiveTechnicians,
  listReports,
  signInWithInstitutionalId,
  uploadPrivateAttachment,
  supabase,
  type CreateReportInput,
  type EquipmentInventoryDetail,
  type Profile,
  type ReportSummary,
  type Role,
} from "./lib/supabase"

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  Gauge,
  Headphones,
  HeartPulse,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorCog,
  PackageOpen,
  Plus,
  QrCode,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  Upload,
  Wifi,
  Wrench,
  X,
  Zap,
} from "lucide-react"

import { NoticesView, TrainingCalendar } from "./components/TrainingViews"
import { InstitutionSettingsView, NotificationsView, PasswordChangeGate, ProfileView } from "./components/PlatformViews"

import {
  AuditView,
  QuotationsView,
  UserPermissionsView,
} from "./components/AdminViews"

import { EquipmentDetail, Inventory } from "./components/InventoryViews"
import { EquipmentReportSelector } from "./components/EquipmentReportSelector"

import { Dashboard } from "./components/DashboardViews"

import {
  DocumentsView,
  MaintenanceView,
  ServiceOrdersView,
} from "./components/OperationalViews"

type View = "dashboard" | "reportes" | "inventario" | "equipo" | "orden" | "calendario" | "avisos" | "cotizaciones" | "usuarios" | "trazabilidad" | "documentos" | "capacitaciones" | "notificaciones" | "configuracion" | "perfil"

const roleMeta = {
  jefe: { label: "Jefe de Ingeniería Clínica", short: "Jefe", initials: "AM" },

  tecnico: { label: "Ingeniero biomédico", short: "Ingeniero", initials: "JR" },

  usuario: { label: "Enfermería / Médico", short: "Clínico", initials: "LM" },
}

const statusTone: Record<string, string> = {
  Operativo: "success",

  "En reparación": "warning",

  "Fuera de servicio": "danger",

  Crítica: "danger",

  Alta: "warning",

  Ordinaria: "success",

  "En atención": "info",

  Asignado: "violet",

  Recibido: "neutral",

  Resuelto: "success",
}

function Button({
  children,

  variant = "primary",

  icon: Icon,

  onClick,

  type = "button",

  className = "",
}: {
  children: React.ReactNode

  variant?: "primary" | "secondary" | "ghost" | "danger"

  icon?: React.ElementType

  onClick?: () => void

  type?: "button" | "submit"

  className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`btn btn-${variant} ${className}`}
    >
      {Icon && <Icon size={18} aria-hidden="true" />}
      {children}
    </button>
  )
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode
  tone?: string
}) {
  const resolved = tone || statusTone[String(children)] || "neutral"

  return <span className={`badge badge-${resolved}`}>{children}</span>
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <div className="brand-mark">
        <Activity size={compact ? 22 : 26} />
      </div>
      {!compact && (
        <div>
          <strong>BioMedGest</strong>
          <span>Ingeniería Clínica</span>
        </div>
      )}
    </div>
  )
}

const navigation: Record<Role, {
  label: string
  view: View
  icon: React.ElementType
}[]> = {
  jefe: [
    { label: "Resumen", view: "dashboard", icon: LayoutDashboard },

    { label: "Mesa de ayuda", view: "reportes", icon: Headphones },

    { label: "Inventario", view: "inventario", icon: MonitorCog },

    { label: "Mantenimiento", view: "calendario", icon: CalendarDays },

    { label: "Documentos", view: "documentos", icon: FileText },
    { label: "Capacitaciones", view: "capacitaciones", icon: CalendarDays },
    { label: "Notificaciones", view: "notificaciones", icon: Bell },
  ],

  tecnico: [
    { label: "Mi jornada", view: "dashboard", icon: LayoutDashboard },

    { label: "Mis órdenes", view: "orden", icon: ClipboardList },

    { label: "Calendario", view: "calendario", icon: CalendarDays },

    { label: "Inventario", view: "inventario", icon: MonitorCog },

    { label: "Documentos", view: "documentos", icon: FileText },
    { label: "Capacitaciones", view: "capacitaciones", icon: CalendarDays },
    { label: "Notificaciones", view: "notificaciones", icon: Bell },
  ],

  usuario: [
    { label: "Inicio", view: "dashboard", icon: LayoutDashboard },

    { label: "Mis reportes", view: "reportes", icon: ClipboardList },

    { label: "Solicitud de equipo", view: "inventario", icon: Search },

    { label: "Avisos", view: "avisos", icon: Bell },
    { label: "Notificaciones", view: "notificaciones", icon: Bell },
  ],
}

function Login({ onLogin }: { onLogin: (profile: Profile) => void }) {
  const [id, setId] = useState("")

  const [password, setPassword] = useState("")

  const [error, setError] = useState("")

  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError("")

    setLoading(true)

    try {
      const profile = await signInWithInstitutionalId(id, password)

      onLogin(profile)
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "No fue posible iniciar sesión.",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-story-inner">
          <Brand />
          <div className="story-copy">
            <Badge tone="blue">Plataforma hospitalaria segura</Badge>
            <h1>
              Equipos disponibles.
              <br />
              Atención sin interrupciones.
            </h1>
            <p>
              Una sola plataforma para cuidar el ciclo de vida del equipo médico
              y mantener la continuidad clínica.
            </p>
          </div>
          <div className="trust-row">
            <ShieldCheck size={20} />
            <span>Alineado a NOM y estándares CSG</span>
          </div>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="eyebrow">Acceso institucional</div>
          <h2>Te damos la bienvenida</h2>
          <p className="muted">
            Ingresa tu ID institucional de 8 dígitos y contraseña.
          </p>
          {!isSupabaseConfigured && (
            <p className="form-error" role="alert">
              Falta configurar Supabase. Copia `.env.example` a `.env.local` y
              agrega las credenciales públicas del proyecto.
            </p>
          )}
          <form onSubmit={submit}>
            <label className="field">
              <span>ID Institucional</span>
              <input
                value={id}
                onChange={(event) =>
                  setId(event.target.value.replace(/\D/g, "").slice(0, 8))
                }
                inputMode="numeric"
                maxLength={8}
                placeholder="00XXXXXX"
              />
              <small className="field-help">
                Utiliza el identificador asignado a tu cuenta.
              </small>
            </label>
            <label className="field">
              <span>Contraseña</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="full-width">
              {loading ? "Validando..." : "Iniciar sesión"}
            </Button>
          </form>
          <p className="privacy">
            Acceso exclusivo para personal autorizado · v2.4
          </p>
        </div>
      </section>
    </main>
  )
}

function Sidebar({
  profile,

  view,

  setView,

  onLogout,
  onProfile,
}: {
  profile: Profile

  view: View

  setView: (view: View) => void

  onLogout: () => void
  onProfile: () => void
}) {
  const role = profile.role

  const initials =
    profile.full_name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || roleMeta[role].initials

  return (
    <aside className="sidebar">
      <Brand />
      <nav className="side-nav" aria-label="Navegación principal">
        <span className="nav-label">OPERACIÓN</span>
        {navigation[role].map(({ label, view: itemView, icon: Icon }) => (
          <button
            key={label}
            className={view === itemView ? "active" : ""}
            onClick={() => setView(itemView)}
          >
            <Icon size={19} />
            <span>{label}</span>
          </button>
        ))}
        {role === "jefe" && (
          <>
            <span className="nav-label">ADMINISTRACIÓN</span>
            <button onClick={() => setView("usuarios")}>
              <Users size={19} />
              <span>Usuarios y permisos</span>
            </button>
            <button onClick={() => setView("trazabilidad")}>
              <History size={19} />
              <span>Trazabilidad</span>
            </button>
            <button onClick={() => setView("cotizaciones")}>
              <FileText size={19} />
              <span>Cotizaciones</span>
            </button>
            <button type="button" onClick={() => setView("configuracion")}>
              <Settings size={19} />
              <span>Configuración</span>
            </button>
          </>
        )}
      </nav>
      <div className="profile">
        <button type="button" className="profile-main" onClick={onProfile}>
        <span className="avatar">{initials}</span>
        <span>
          <strong>{profile.full_name}</strong>
          <small>{roleMeta[role].label}</small>
        </span>
        </button>
        <button type="button" className="icon-btn" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={onLogout}><LogOut size={17} /></button>
      </div>
    </aside>
  )
}

function AppHeader({ profile, title }: { profile: Profile; title: string }) {
  const role = profile.role

  const initials =
    profile.full_name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || roleMeta[role].initials

  return (
    <header className="app-header">
      <div className="mobile-logo">
        <Brand compact />
      </div>
      <div>
        <span className="breadcrumb">
          BioMedGest{profile.department ? ` / ${profile.department}` : ""}
        </span>
        <h1>{title}</h1>
      </div>
      <div className="header-actions">
        <div className="connection">
          <Wifi size={15} /> En línea
        </div>
        <div className="header-user">
          <span className="avatar">{initials}</span>
          <span>
            <strong>{profile.full_name}</strong>
            <small>{roleMeta[role].short}</small>
          </span>
        </div>
      </div>
    </header>
  )
}

function PageIntro({
  eyebrow,

  title,

  description,

  action,
}: {
  eyebrow?: string

  title: string

  description: string

  action?: React.ReactNode
}) {
  return (
    <div className="page-intro">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

function ReportWorkflowEditor({ report, technicians, onCreated }: { report: ReportSummary; technicians: Profile[]; onCreated: () => void }) {
  const [priority, setPriority] = useState<"critica" | "alta" | "ordinaria">(
    report.priority === "Crítica" ? "critica" : report.priority === "Alta" ? "alta" : "ordinaria",
  )
  const [assignedTo, setAssignedTo] = useState("")
  const [scheduledAt, setScheduledAt] = useState(() => {
    const now = new Date()
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function save() {
    if (!assignedTo || !scheduledAt) {
      setError("Selecciona un técnico activo y la fecha de atención.")
      return
    }
    setSaving(true)
    setError("")
    try {
      await createCorrectiveOrderFromReport(report.id, assignedTo, priority, new Date(scheduledAt).toISOString())
      onCreated()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible crear la orden correctiva.")
    } finally {
      setSaving(false)
    }
  }

  if (report.maintenance_id)
    return <div className="report-workflow-editor"><Badge>Orden vinculada</Badge><Badge>{report.status}</Badge></div>

  return (
    <div className="report-workflow-editor">
      <label><span>Prioridad</span><select aria-label={`Prioridad de ${report.report_number}`} value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}><option value="critica">Crítica</option><option value="alta">Alta</option><option value="ordinaria">Ordinaria</option></select></label>
      <label><span>Técnico</span><select aria-label={`Técnico de ${report.report_number}`} value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}><option value="">Seleccionar</option>{technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.full_name}</option>)}</select></label>
      <label><span>Atención</span><input aria-label={`Fecha de atención de ${report.report_number}`} type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
      <button type="button" className="row-action" disabled={saving || technicians.length === 0} onClick={save}>{saving ? "Creando..." : "Clasificar y crear orden"}</button>
      {error && <small className="form-error" role="alert">{error}</small>}
    </div>
  )
}

function ReportTray({
  role,
  setView,
  openReport,
}: {
  role: Role
  setView: (v: View) => void
  openReport: () => void
}) {
  const [reports, setReports] =
    useState<Awaited<ReturnType<typeof listReports>>>([])

  const [technicians, setTechnicians] = useState<Profile[]>([])

  const [error, setError] = useState("")

  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState("")

  const [priority, setPriority] = useState("")

  const [status, setStatus] = useState("")

  useEffect(() => {
    const load = () => {
      setLoading(true)
      setError("")
      Promise.all([
        listReports(),
        role === "jefe" ? listActiveTechnicians() : Promise.resolve([]),
      ])
        .then(([reportRows, technicianRows]) => {
          setReports(reportRows)
          setTechnicians(technicianRows)
        })
        .catch((reportError) => {
          setError(
            reportError instanceof Error
              ? reportError.message
              : "No fue posible cargar los reportes.",
          )
        })
        .finally(() => setLoading(false))
    }
    load()
    window.addEventListener("biomedgest:reports-changed", load)
    return () => window.removeEventListener("biomedgest:reports-changed", load)
  }, [role])

  const filteredReports = useMemo(
    () =>
      reports.filter((report) => {
        const normalized = searchTerm.trim().toLocaleLowerCase("es-MX")

        const matchesSearch =
          !normalized ||
          [
            report.report_number,
            report.equipment_identifier,
            report.description,
            report.service,
          ].some((value) =>
            value.toLocaleLowerCase("es-MX").includes(normalized),
          )

        return (
          matchesSearch &&
          (!priority || report.priority === priority) &&
          (!status || report.status === status)
        )
      }),
    [priority, reports, searchTerm, status],
  )

  return (
    <>
      <PageIntro
        title={role === "usuario" ? "Mis reportes" : "Mesa de ayuda"}
        description={
          role === "usuario"
            ? "Seguimiento de solicitudes y fallas reportadas."
            : "Clasifica, prioriza y asigna reportes de equipamiento médico."
        }
        action={
          <Button icon={Plus} onClick={openReport}>
            {role === "usuario" ? "Reportar falla" : "Registrar reporte"}
          </Button>
        }
      />
      <section className="panel orders-panel">
        <div className="filter-bar">
          <label className="search-box">
            <Search size={18} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar folio, equipo o servicio..."
            />
          </label>
          <label className="inventory-select">
            <span>Prioridad</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              <option value="">Todas</option>
              <option>Crítica</option>
              <option>Alta</option>
              <option>Ordinaria</option>
            </select>
          </label>
          <label className="inventory-select">
            <span>Estado</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos</option>
              <option>Recibido</option>
              <option>Clasificado</option>
              <option>Asignado</option>
              <option>En atención</option>
              <option>Resuelto</option>
              <option>Cerrado</option>
            </select>
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <div className="empty-state">
            <h3>Cargando reportes...</h3>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="empty-state">
            <h3>No hay reportes para mostrar</h3>
            <p>
              {reports.length === 0
                ? "No existen registros visibles para tu cuenta."
                : "Prueba con otros filtros."}
            </p>
          </div>
        ) : (
          <div className="ticket-list">
            {filteredReports.map((report) => (
              <article key={report.report_number}>
                <i
                  className={`ticket-signal ${
                    report.priority === "Crítica"
                      ? "red"
                      : report.priority === "Alta"
                        ? "amber"
                        : "green"
                  }`}
                />
                <div className="ticket-main">
                  <span>
                    {report.report_number} ·{" "}
                    {new Date(report.created_at).toLocaleString("es-MX")}
                  </span>
                  <strong>{report.description}</strong>
                  <small>
                    {report.equipment_identifier} · {report.service}
                  </small>
                  <details className="report-detail">
                    <summary>Ver detalle</summary>
                    <span>{report.event_type} · {report.event_date}</span>
                    <span>{report.manufacturer || "Fabricante no registrado"} · {report.model_serial || "Modelo/serie no registrado"}</span>
                    <span>{report.location || "Ubicación no registrada"}</span>
                    <span>Consecuencia: {report.patient_outcome || "No registrada"}</span>
                    <span>Acción inicial: {report.action_taken || "No registrada"}</span>
                  </details>
                </div>
                {role === "jefe" && <ReportWorkflowEditor report={report} technicians={technicians} onCreated={() => listReports().then(setReports).catch(() => undefined)} />}
                {role !== "jefe" && <><Badge>{report.priority}</Badge><Badge>{report.status}</Badge></>}
                {role === "jefe" && <Button variant="secondary" onClick={() => setView("orden")}>Ver órdenes</Button>}
                <ChevronRight size={18} />
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

export function ReportModal({ onClose, role }: { onClose: () => void; role: Role }) {
  const [sent, setSent] = useState(false)

  const [reportNumber, setReportNumber] = useState("")
  const [reportId, setReportId] = useState<number | null>(null)
  const [evidence, setEvidence] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")

  const [error, setError] = useState("")

  const [saving, setSaving] = useState(false)

  const [selectedEquipment, setSelectedEquipment] =
    useState<EquipmentInventoryDetail | null>(null)

  const [form, setForm] = useState<CreateReportInput>({
    equipmentId: null,

    equipmentIdentifier: "",

    eventDate: new Date().toISOString().slice(0, 10),

    eventType: "",

    service: "",

    location: "",

    manufacturer: "",

    modelSerial: "",

    description: "",

    patientOutcome: "",

    actionTaken: "",
  })

  function updateField(field: keyof CreateReportInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError("")

    setSaving(true)

    try {
      const createdNumber = await createReport(form)
      setReportNumber(createdNumber)
      setSent(true)
      window.dispatchEvent(new Event("biomedgest:reports-changed"))
      if (isOperationalCompletionEnabled) {
        try { setReportId(await getReportIdByNumber(createdNumber)) }
        catch { setUploadError("El reporte se guardó, pero no fue posible habilitar su evidencia en esta sesión.") }
      }
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : "No fue posible guardar el reporte.",
      )
    } finally {
      setSaving(false)
    }
  }

  if (sent)
    return (
      <div className="modal-layer">
        <div className="modal success-modal">
          <div className="success-mark">
            <Check size={30} />
          </div>
          <h2>Reporte recibido</h2>
          <p>
            El folio <strong>{reportNumber}</strong> fue enviado a Ingeniería
            Clínica. Te notificaremos cada avance.
          </p>
          {isOperationalCompletionEnabled && reportId && <div className="attachment-panel"><strong>Evidencia opcional</strong><input aria-label="Evidencia del reporte" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.doc,.docx" onChange={(event) => setEvidence(event.target.files?.[0] || null)} /><button type="button" className="row-action" disabled={!evidence || uploading} onClick={async () => { if (!evidence) return; setUploading(true); setUploadError(""); try { await uploadPrivateAttachment(evidence, { reportId }, "Evidencia adjunta al reporte"); setEvidence(null) } catch (cause) { setUploadError(cause instanceof Error ? cause.message : "No fue posible subir la evidencia.") } finally { setUploading(false) } }}><Upload size={15} />{uploading ? "Subiendo..." : "Subir evidencia"}</button>{uploadError && <small className="form-error">{uploadError}</small>}</div>}
          {isOperationalCompletionEnabled && !reportId && uploadError && <small className="form-error">{uploadError}</small>}
          <Button onClick={onClose}>Entendido</Button>
        </div>
      </div>
    )

  return (
    <div className="modal-layer">
      <form className="modal report-modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">Nuevo reporte</span>
            <h2>Reportar falla de equipo</h2>
            <p>Cuéntanos qué sucede. Los campos con * son obligatorios.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={21} />
          </button>
        </div>
        <div className="form-grid">
          <div className="field span-2">
            <span>Equipo o número de inventario *</span>
            <EquipmentReportSelector
              role={role}
              value={form.equipmentIdentifier}
              selected={selectedEquipment}
              onInputChange={(value) => {
                setSelectedEquipment(null)
                setForm((current) => ({
                  ...current,
                  equipmentId: null,
                  equipmentIdentifier: value,
                }))
              }}
              onSelect={(equipment) => {
                setSelectedEquipment(equipment)
                setForm((current) => ({
                  ...current,
                  equipmentId: equipment.id,
                  equipmentIdentifier: equipment.inventory_code,
                  location: current.location || equipment.location || "",
                  manufacturer: current.manufacturer || equipment.manufacturer,
                  modelSerial:
                    current.modelSerial ||
                    [equipment.model, equipment.serial_number]
                      .filter(Boolean)
                      .join(" / "),
                }))
                setError("")
              }}
            />
            <div className="report-qr-action">
              <button
                type="button"
                disabled
                title="El lector QR todavía no está integrado"
              >
                <QrCode size={19} /> QR pendiente
              </button>
            </div>
          </div>
          <label className="field">
            <span>Fecha del evento *</span>
            <input
              required
              type="date"
              lang="es-MX"
              value={form.eventDate}
              onChange={(event) => updateField("eventDate", event.target.value)}
            />
            {form.eventDate && (
              <small>
                {new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(
                  new Date(`${form.eventDate}T12:00:00`),
                )}
              </small>
            )}
          </label>
          <label className="field">
            <span>Tipo de evento *</span>
            <select
              required
              value={form.eventType}
              onChange={(event) => updateField("eventType", event.target.value)}
            >
              <option value="" disabled>
                Selecciona una opción
              </option>
              <option>Falla</option>
              <option>Incidente</option>
              <option>Mal funcionamiento</option>
              <option>Lesión asociada</option>
            </select>
          </label>
          <label className="field">
            <span>Servicio *</span>
            <select
              required
              value={form.service}
              onChange={(event) => updateField("service", event.target.value)}
            >
              <option value="" disabled>
                Selecciona una opción
              </option>
              <option>Urgencias</option>
              <option>Hospitalización</option>
              <option>UCI Adultos</option>
            </select>
          </label>
          <label className="field">
            <span>Ubicación</span>
            <input
              value={form.location}
              onChange={(event) => updateField("location", event.target.value)}
              placeholder="Ej. Cubículo 3"
            />
          </label>
          <label className="field">
            <span>Fabricante</span>
            <input
              value={form.manufacturer}
              onChange={(event) =>
                updateField("manufacturer", event.target.value)
              }
              placeholder="Fabricante del equipo"
            />
          </label>
          <label className="field">
            <span>Modelo / serie</span>
            <input
              value={form.modelSerial}
              onChange={(event) =>
                updateField("modelSerial", event.target.value)
              }
              placeholder="Modelo y número de serie"
            />
          </label>
          <label className="field span-2">
            <span>Descripción del evento *</span>
            <textarea
              required
              value={form.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              placeholder="Describe qué ocurrió, cuándo comenzó y las condiciones del equipo..."
            />
          </label>
          <label className="field">
            <span>Resultado para el paciente</span>
            <select
              value={form.patientOutcome}
              onChange={(event) =>
                updateField("patientOutcome", event.target.value)
              }
            >
              <option value="">Sin registrar</option>
              <option>Sin lesión</option>
              <option>Lesión temporal</option>
              <option>Lesión grave</option>
              <option>Fallecimiento</option>
              <option>No aplica</option>
            </select>
          </label>
          <label className="field">
            <span>Acción tomada</span>
            <input
              value={form.actionTaken}
              onChange={(event) =>
                updateField("actionTaken", event.target.value)
              }
              placeholder="Equipo retirado, atención inmediata..."
            />
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="priority-suggest">
          <AlertTriangle size={20} />
          <div>
            <strong>La prioridad inicial será ordinaria</strong>
            <span>
              Un jefe podrá clasificar el reporte posteriormente; todavía no
              existe un cálculo automático de prioridad.
            </span>
          </div>
        </div>
        <div className="photo-upload" aria-disabled="true">
          <Plus size={20} />
          <span>
            <strong>Adjuntos pendientes de implementación</strong>
            <small>
              No se enviarán archivos hasta contar con Storage y políticas
              aprobadas.
            </small>
          </span>
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">
            {saving ? "Guardando..." : "Enviar reporte"}
          </Button>
        </div>
      </form>
    </div>
  )
}

function BottomNav({
  role,
  view,
  setView,
}: {
  role: Role
  view: View
  setView: (v: View) => void
}) {
  return (
    <nav className="bottom-nav">
      {navigation[role].slice(0, 4).map(({ label, view: v, icon: Icon }) => (
        <button
          key={label}
          className={view === v ? "active" : ""}
          onClick={() => setView(v)}
        >
          <Icon size={20} />
          <span>{label.split(" ")[0]}</span>
        </button>
      ))}
    </nav>
  )
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)

  const role = profile?.role ?? null

  const [view, setView] = useState<View>("dashboard")

  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(
    null,
  )

  const [reportOpen, setReportOpen] = useState(false)

  const [loadingSession, setLoadingSession] = useState(true)

  useEffect(() => {
    let mounted = true
    const refreshProfile = () => {
      getCurrentProfile()
        .then((currentProfile) => {
          if (mounted) setProfile(currentProfile)
        })
        .catch(() => {
          if (mounted) setProfile(null)
        })
        .finally(() => {
          if (mounted) setLoadingSession(false)
        })
    }

    refreshProfile()
    const authSubscription = supabase?.auth.onAuthStateChange((event) => {
      if (!mounted) return
      if (event === "SIGNED_OUT") {
        setProfile(null)
        setLoadingSession(false)
        return
      }
      if (["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED", "INITIAL_SESSION"].includes(event)) {
        window.setTimeout(refreshProfile, 0)
      }
    })
    window.addEventListener("focus", refreshProfile)

    return () => {
      mounted = false
      window.removeEventListener("focus", refreshProfile)
      authSubscription?.data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!profile) return
    const equipmentId = new URLSearchParams(window.location.search).get("equipment")
    if (equipmentId) {
      setSelectedEquipmentId(equipmentId)
      setView("equipo")
    }
  }, [profile])

  const title = useMemo(
    () =>
      ({
        dashboard:
          role === "jefe"
            ? "Panel de control"
            : role === "tecnico"
              ? "Mi jornada"
              : "Inicio",

        reportes: role === "usuario" ? "Mis reportes" : "Mesa de ayuda",

        inventario: "Inventario",

        equipo: "Ficha de equipo",

        orden: "Orden de servicio",


        calendario: "Mantenimiento",

        avisos: "Avisos",

        cotizaciones: "Cotizaciones",

        usuarios: "Usuarios y permisos",

        trazabilidad: "Trazabilidad",

        documentos: "Documentos",
        capacitaciones: "Capacitaciones",
        notificaciones: "Notificaciones",
        configuracion: "Configuración institucional",
        perfil: "Mi perfil",
      })[view],
    [role, view],
  )

  if (loadingSession)
    return <main className="session-loading">Cargando sesión...</main>

  if (!profile || !role)
    return (
      <Login
        onLogin={(authenticatedProfile) => {
          setProfile(authenticatedProfile)
          setView("dashboard")
        }}
      />
    )

  return (
    <div className="app-shell">
      <Sidebar
        profile={profile}
        view={view}
        setView={setView}
        onLogout={() => {
          void supabase?.auth.signOut()
          setProfile(null)
        }}
        onProfile={() => setView("perfil")}
      />
      <div className="app-main">
        <AppHeader profile={profile} title={title} />
        <main className="content">
          {view === "dashboard" && (
            <Dashboard profile={profile} setView={setView} />
          )}
          {view === "inventario" && (
            <Inventory
              role={role}
              onSelectEquipment={(equipmentId) => {
                setSelectedEquipmentId(equipmentId)
                const url = new URL(window.location.href)
                url.searchParams.set("equipment", equipmentId)
                window.history.replaceState({}, "", url)
                setView("equipo")
              }}
            />
          )}
          {view === "equipo" && (
            <EquipmentDetail
              equipmentId={selectedEquipmentId}
              role={role}
              onBack={() => {
                const url = new URL(window.location.href)
                url.searchParams.delete("equipment")
                window.history.replaceState({}, "", url)
                setView("inventario")
              }}
            />
          )}
          {view === "orden" && <ServiceOrdersView role={role} />}
          {view === "calendario" && <MaintenanceView role={role} />}
          {view === "avisos" && <NoticesView />}
          {view === "capacitaciones" && <TrainingCalendar role={role} />}
          {view === "notificaciones" && <NotificationsView />}
          {view === "configuracion" && role === "jefe" && <InstitutionSettingsView />}
          {view === "perfil" && <ProfileView profile={profile} onUpdated={setProfile} />}
          {view === "cotizaciones" && <QuotationsView />}
          {view === "usuarios" && <UserPermissionsView />}
          {view === "trazabilidad" && <AuditView />}
          {view === "documentos" && <DocumentsView />}
          {view === "reportes" && (
            <ReportTray
              role={role}
              setView={setView}
              openReport={() => setReportOpen(true)}
            />
          )}
        </main>
      </div>
      <BottomNav role={role} view={view} setView={setView} />
      {reportOpen && <ReportModal role={role} onClose={() => setReportOpen(false)} />}
      {profile.must_change_password && <PasswordChangeGate onCompleted={setProfile} />}
    </div>
  )
}
