import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CalendarDays,
  ExternalLink,
  FileText,
  RefreshCw,
  Wrench,
} from "lucide-react"
import {
  listDocumentLibrary,
  listMaintenanceOverview,
  updateAssignedMaintenanceStatus,
  type DocumentLibraryItem,
  type MaintenanceCatalogItem,
  type MaintenanceSummary,
  type Role,
} from "../lib/supabase"
import { Button, PageIntro } from "./ui"

function safeUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null
  } catch {
    return null
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function Loading({ label }: { label: string }) {
  return (
    <section className="panel empty-state" aria-busy="true">
      <RefreshCw className="spin" size={34} />
      <h3>{label}</h3>
    </section>
  )
}

function Failure({ error, retry }: { error: string; retry: () => void }) {
  return (
    <section className="panel empty-state" role="alert">
      <AlertTriangle size={34} />
      <h3>No fue posible consultar la información</h3>
      <p>{error}</p>
      <Button icon={RefreshCw} variant="secondary" onClick={retry}>
        Reintentar
      </Button>
    </section>
  )
}

function useMaintenanceOverview() {
  const [catalog, setCatalog] = useState<MaintenanceCatalogItem[]>([])
  const [maintenances, setMaintenances] = useState<MaintenanceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    listMaintenanceOverview()
      .then((result) => {
        if (active) {
          setCatalog(result.catalog)
          setMaintenances(result.maintenances)
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Error de consulta no identificado.",
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reload])
  return {
    catalog,
    maintenances,
    loading,
    error,
    retry: () => setReload((value) => value + 1),
  }
}

export function MaintenanceView({ role }: { role: Role }) {
  const state = useMaintenanceOverview()
  const counts = useMemo(
    () =>
      state.maintenances.reduce<Record<string, number>>((result, item) => {
        if (item.status !== "cancelado")
          result[item.maintenance_code] =
            (result[item.maintenance_code] || 0) + 1
        return result
      }, {}),
    [state.maintenances],
  )
  if (state.loading) return <Loading label="Consultando mantenimientos..." />
  if (state.error) return <Failure error={state.error} retry={state.retry} />
  return (
    <>
      <PageIntro
        title="Mantenimiento"
        description="Órdenes y actividades realmente registradas y visibles para tu sesión."
      />
      <section className="maintenance-catalog">
        {state.catalog.map((item) => (
          <article className="panel maintenance-type" key={item.code}>
            <div className="maintenance-code">{item.code}</div>
            <div>
              <span className="eyebrow">Tipo de mantenimiento</span>
              <h3>{item.label}</h3>
              <p>{item.description}</p>
            </div>
            <strong>
              {counts[item.code] || 0}
              <small>registrados</small>
            </strong>
          </article>
        ))}
      </section>
      <section className="panel orders-panel">
        <div className="panel-head">
          <div>
            <h3>
              {role === "tecnico"
                ? "Mis mantenimientos"
                : "Mantenimientos programados"}
            </h3>
            <p>
              No se generan eventos de calendario a partir de rutinas sin
              periodicidad.
            </p>
          </div>
          <CalendarDays size={21} />
        </div>
        <MaintenanceTable items={state.maintenances} role={role} onChanged={state.retry} />
      </section>
    </>
  )
}

export function ServiceOrdersView({ role }: { role: Role }) {
  const state = useMaintenanceOverview()
  if (state.loading)
    return <Loading label="Consultando órdenes de servicio..." />
  if (state.error) return <Failure error={state.error} retry={state.retry} />
  return (
    <>
      <PageIntro
        title="Órdenes de servicio"
        description="Mantenimientos creados en Supabase; los formularios técnicos detallados se habilitarán cuando exista una orden seleccionada."
      />
      <section className="panel orders-panel">
        <MaintenanceTable items={state.maintenances} role={role} onChanged={state.retry} />
      </section>
    </>
  )
}

function MaintenanceStatusEditor({ item, onChanged }: { item: MaintenanceSummary; onChanged: () => void }) {
  const [status, setStatus] = useState(item.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => setStatus(item.status), [item.status])

  async function save() {
    setSaving(true)
    setError("")
    try {
      await updateAssignedMaintenanceStatus(item.id, status)
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible actualizar la orden.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="maintenance-status-editor">
      <select aria-label={`Estado de ${item.maintenance_number}`} value={status} onChange={(event) => setStatus(event.target.value as MaintenanceSummary["status"])}>
        <option value="programado">Programado</option>
        <option value="en_proceso">En proceso</option>
        <option value="completado">Completado</option>
        <option value="cancelado">Cancelado</option>
      </select>
      <button type="button" className="row-action" disabled={saving || status === item.status} onClick={save}>
        {saving ? "Guardando..." : "Guardar"}
      </button>
      {error && <small className="form-error" role="alert">{error}</small>}
    </div>
  )
}

function MaintenanceTable({ items, role, onChanged }: { items: MaintenanceSummary[]; role: Role; onChanged: () => void }) {
  if (items.length === 0)
    return (
      <div className="empty-state">
        <Wrench size={34} />
        <h3>No hay mantenimientos registrados</h3>
        <p>No se muestran órdenes ni fechas simuladas.</p>
      </div>
    )
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Orden</th>
            <th>Equipo</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th>Prioridad</th>
            <th>Programación</th>
            {(role === "jefe" || role === "tecnico") && <th>Actualizar</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong className="order-id">{item.maintenance_number}</strong>
              </td>
              <td>{item.equipment_identifier || "Equipo vinculado"}</td>
              <td>{item.maintenance_code}</td>
              <td>{item.status.replace(/_/g, " ")}</td>
              <td>{item.priority || "Sin registrar"}</td>
              <td>{formatDate(item.scheduled_at)}</td>
              {(role === "jefe" || role === "tecnico") && <td><MaintenanceStatusEditor item={item} onChanged={onChanged} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function DocumentsView() {
  const [documents, setDocuments] = useState<DocumentLibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    listDocumentLibrary()
      .then((items) => {
        if (active) setDocuments(items)
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Error de consulta no identificado.",
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reload])
  if (loading) return <Loading label="Consultando documentos..." />
  if (error)
    return (
      <Failure error={error} retry={() => setReload((value) => value + 1)} />
    )
  return (
    <>
      <PageIntro
        title="Documentos"
        description="Vínculos registrados para manuales y referencias. Su registro no garantiza que el archivo externo siga disponible."
      />
      <section className="panel">
        <div className="document-list">
          {documents.map((document) => {
            const href = safeUrl(document.url)
            return (
              <article key={document.id}>
                <FileText size={20} />
                <div>
                  <strong>
                    {document.title ||
                      (document.document_type === "manual_usuario"
                        ? "Manual de usuario"
                        : "Manual de servicio")}
                  </strong>
                  <span>
                    {document.document_type.replace(/_/g, " ")} ·{" "}
                    {document.linkedEquipment} equipo
                    {document.linkedEquipment === 1 ? "" : "s"} ·{" "}
                    Vínculo registrado · {document.review_status}
                  </span>
                </div>
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer">
                    Abrir vínculo <ExternalLink size={14} />
                  </a>
                ) : (
                  <span className="badge badge-warning">
                    Enlace por revisar
                  </span>
                )}
              </article>
            )
          })}
        </div>
        {documents.length === 0 && (
          <div className="empty-state">
            <FileText size={34} />
            <h3>No hay documentos visibles</h3>
          </div>
        )}
      </section>
    </>
  )
}
