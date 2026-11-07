import { Fragment, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CalendarDays,
  ExternalLink,
  FileText,
  RefreshCw,
  Upload,
  Wrench,
} from "lucide-react"
import {
  createAttachmentDownloadUrl,
  deletePrivateAttachment,
  isOperationalCompletionEnabled,
  listDocumentLibrary,
  listMaintenanceOverview,
  saveCorrectiveIntervention,
  savePreventiveIntervention,
  uploadPrivateAttachment,
  updateAssignedMaintenanceStatus,
  validateCorrectiveClosure,
  validatePreventiveClosure,
  type FileAttachment,
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

function toLocalInput(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
}

function nowLocalInput() {
  return toLocalInput(new Date().toISOString())
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
  const preventiveState = useMemo(() => {
    const now = Date.now()
    const warning = now + 30 * 24 * 60 * 60 * 1000
    return state.maintenances.filter((item) => item.maintenance_code === "MP" && item.status === "programado").reduce((result, item) => {
      const scheduled = new Date(item.scheduled_at).getTime()
      if (scheduled < now) result.overdue += 1
      else if (scheduled <= warning) result.upcoming += 1
      else result.later += 1
      return result
    }, { overdue: 0, upcoming: 0, later: 0 })
  }, [state.maintenances])
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
      <section className="maintenance-catalog preventive-summary"><article className="panel maintenance-type"><div className="maintenance-code">!</div><div><h3>Preventivos vencidos</h3><p>Órdenes programadas cuya fecha ya pasó.</p></div><strong>{preventiveState.overdue}</strong></article><article className="panel maintenance-type"><div className="maintenance-code">30</div><div><h3>Próximos 30 días</h3><p>Fechas registradas, sin periodicidades inferidas.</p></div><strong>{preventiveState.upcoming}</strong></article><article className="panel maintenance-type"><div className="maintenance-code">+</div><div><h3>Posteriores</h3><p>Preventivos pendientes fuera de la ventana inmediata.</p></div><strong>{preventiveState.later}</strong></article></section>
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

function MaintenanceStatusEditor({ item, role, onChanged }: { item: MaintenanceSummary; role: Role; onChanged: () => void }) {
  const options = item.status === "programado"
    ? role === "tecnico" ? ["en_proceso"] : ["en_proceso", "cancelado"]
    : item.status === "en_proceso" && role === "jefe" ? ["cancelado"] : []
  const [status, setStatus] = useState<MaintenanceSummary["status"]>((options[0] || item.status) as MaintenanceSummary["status"])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => setStatus((options[0] || item.status) as MaintenanceSummary["status"]), [item.status, role])

  if (options.length === 0) return <span className="muted-copy">Sin transición disponible</span>

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
        {options.map((option) => <option key={option} value={option}>{option === "en_proceso" ? "Iniciar" : "Cancelar"}</option>)}
      </select>
      <button type="button" className="row-action" disabled={saving} onClick={save}>
        {saving ? "Guardando..." : "Aplicar"}
      </button>
      {error && <small className="form-error" role="alert">{error}</small>}
    </div>
  )
}

function MaintenanceTable({ items, role, onChanged }: { items: MaintenanceSummary[]; role: Role; onChanged: () => void }) {
  const [expanded, setExpanded] = useState<number | null>(null)
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
            {(role === "jefe" || role === "tecnico") && <th>Expediente</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <Fragment key={item.id}>
            <tr>
              <td>
                <strong className="order-id">{item.maintenance_number}</strong>
              </td>
              <td><strong>{item.equipment_identifier || "Equipo vinculado"}</strong>{item.equipment && <small className="table-subline">{item.equipment.equipment_type} · {item.equipment.manufacturer} {item.equipment.model}</small>}</td>
              <td>{item.maintenance_code}</td>
              <td>{item.status.replace(/_/g, " ")}</td>
              <td>{item.priority || "Sin registrar"}</td>
              <td>{formatDate(item.scheduled_at)}</td>
              {(role === "jefe" || role === "tecnico") && <td><MaintenanceStatusEditor item={item} role={role} onChanged={onChanged} /></td>}
              {(role === "jefe" || role === "tecnico") && <td><button type="button" className="row-action" onClick={() => setExpanded((current) => current === item.id ? null : item.id)}>{expanded === item.id ? "Ocultar" : "Abrir"}</button></td>}
            </tr>
            {expanded === item.id && (role === "jefe" || role === "tecnico") && (
              <tr className="maintenance-detail-row"><td colSpan={8}><CorrectiveWorkflowPanel item={item} role={role} onChanged={onChanged} /></td></tr>
            )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CorrectiveWorkflowPanel({ item, role, onChanged }: { item: MaintenanceSummary; role: Role; onChanged: () => void }) {
  if (item.maintenance_code === "MP")
    return <PreventiveWorkflowPanel item={item} role={role} onChanged={onChanged} />

  const record = item.record
  const [startedAt, setStartedAt] = useState(toLocalInput(record?.started_at) || nowLocalInput())
  const [completedAt, setCompletedAt] = useState(toLocalInput(record?.completed_at))
  const [diagnosis, setDiagnosis] = useState(record?.diagnosis || "")
  const [workPerformed, setWorkPerformed] = useState(record?.work_performed || "")
  const [testResults, setTestResults] = useState(record?.test_results || "")
  const [condition, setCondition] = useState<"" | "operativo" | "en_reparacion" | "fuera_de_servicio">(record?.equipment_condition || "")
  const [technicalNotes, setTechnicalNotes] = useState(record?.technical_notes || "")
  const [closureNotes, setClosureNotes] = useState(item.closure_notes || "")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function save(finalize: boolean) {
    setSaving(true)
    setError("")
    setMessage("")
    try {
      const finalCompletedAt = finalize ? (completedAt || nowLocalInput()) : null
      await saveCorrectiveIntervention(item.id, {
        startedAt: new Date(startedAt).toISOString(),
        completedAt: finalCompletedAt ? new Date(finalCompletedAt).toISOString() : null,
        diagnosis,
        workPerformed,
        testResults,
        equipmentCondition: condition || null,
        technicalNotes,
      })
      setCompletedAt(finalCompletedAt || "")
      setMessage(finalize ? "Expediente enviado para validación del jefe." : "Borrador técnico guardado.")
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible guardar la intervención.")
    } finally {
      setSaving(false)
    }
  }

  async function close() {
    setSaving(true)
    setError("")
    setMessage("")
    try {
      await validateCorrectiveClosure(item.id, closureNotes)
      setMessage("Orden y reporte cerrados de forma transaccional.")
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible validar el cierre.")
    } finally {
      setSaving(false)
    }
  }

  if (item.maintenance_code !== "MC")
    return <div className="corrective-workflow"><p>Esta orden no corresponde a mantenimiento correctivo.</p></div>

  return (
    <section className="corrective-workflow">
      <div className="corrective-summary">
        <strong>{item.report_number ? `Reporte ${item.report_number}` : "Sin reporte vinculado"}</strong>
        <span>Estado del reporte: {item.report_status || "No disponible"}</span>
        <span>Técnico asignado: {item.assigned_to_name || "No disponible"}</span>
        {item.equipment && <span>Equipo: {item.equipment.inventory_code} · {item.equipment.equipment_type} · {item.equipment.manufacturer} {item.equipment.model} · {item.equipment.hospital_area || "Área sin registrar"}</span>}
        <span>La evidencia documental depende de configurar Supabase Storage; no se simularán archivos.</span>
      </div>
      {role === "tecnico" && item.status === "programado" && <p>Inicia la orden antes de registrar la intervención.</p>}
      {role === "tecnico" && item.status === "en_proceso" && (
        <div className="corrective-form">
          <label><span>Inicio *</span><input type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} /></label>
          <label><span>Finalización</span><input type="datetime-local" value={completedAt} onChange={(event) => setCompletedAt(event.target.value)} /></label>
          <label className="span-2"><span>Diagnóstico *</span><textarea value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} /></label>
          <label className="span-2"><span>Trabajo realizado *</span><textarea value={workPerformed} onChange={(event) => setWorkPerformed(event.target.value)} /></label>
          <label className="span-2"><span>Resultados de pruebas *</span><textarea value={testResults} onChange={(event) => setTestResults(event.target.value)} /></label>
          <label><span>Condición final *</span><select value={condition} onChange={(event) => setCondition(event.target.value as typeof condition)}><option value="">Seleccionar</option><option value="operativo">Operativo</option><option value="en_reparacion">En reparación</option><option value="fuera_de_servicio">Fuera de servicio</option></select></label>
          <label className="span-2"><span>Observaciones técnicas</span><textarea value={technicalNotes} onChange={(event) => setTechnicalNotes(event.target.value)} /></label>
          <div className="corrective-actions"><button type="button" className="row-action" disabled={saving || !startedAt} onClick={() => save(false)}>Guardar borrador</button><button type="button" className="row-action" disabled={saving || !startedAt} onClick={() => save(true)}>Enviar para validación</button></div>
        </div>
      )}
      {record && role === "jefe" && (
        <div className="technical-record-summary">
          <strong>Expediente técnico</strong>
          <span>Inicio: {record.started_at ? formatDate(record.started_at) : "Pendiente"}</span>
          <span>Finalización: {record.completed_at ? formatDate(record.completed_at) : "Pendiente"}</span>
          <p><b>Diagnóstico:</b> {record.diagnosis || "Pendiente"}</p>
          <p><b>Trabajo:</b> {record.work_performed || "Pendiente"}</p>
          <p><b>Pruebas:</b> {record.test_results || "Pendiente"}</p>
          <p><b>Condición:</b> {record.equipment_condition || "Pendiente"}</p>
        </div>
      )}
      {role === "jefe" && item.status === "en_proceso" && (
        <div className="closure-panel"><label><span>Observaciones de validación</span><textarea value={closureNotes} onChange={(event) => setClosureNotes(event.target.value)} /></label><button type="button" className="row-action" disabled={saving || !record?.completed_at} onClick={close}>Validar y cerrar</button>{!record?.completed_at && <small>El técnico debe finalizar primero el expediente.</small>}</div>
      )}
      {item.validated_at && <p>Validado el {formatDate(item.validated_at)}.</p>}
      {isOperationalCompletionEnabled && <AttachmentPanel maintenanceId={item.id} attachments={item.attachments || []} onChanged={onChanged} />}
      {message && <p className="form-success" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}

function PreventiveWorkflowPanel({ item, role, onChanged }: { item: MaintenanceSummary; role: Role; onChanged: () => void }) {
  const record = item.record
  const [startedAt, setStartedAt] = useState(toLocalInput(record?.started_at) || nowLocalInput())
  const [completedAt, setCompletedAt] = useState(toLocalInput(record?.completed_at))
  const [diagnosis, setDiagnosis] = useState(record?.diagnosis || "")
  const [workPerformed, setWorkPerformed] = useState(record?.work_performed || "")
  const [testResults, setTestResults] = useState(record?.test_results || "")
  const [condition, setCondition] = useState<"" | "operativo" | "en_reparacion" | "fuera_de_servicio">(record?.equipment_condition || "")
  const [technicalNotes, setTechnicalNotes] = useState(record?.technical_notes || "")
  const [activitiesText, setActivitiesText] = useState((item.activities || []).map((activity) => activity.activity).join("\n"))
  const [closureNotes, setClosureNotes] = useState(item.closure_notes || "")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  if (!isOperationalCompletionEnabled)
    return <div className="corrective-workflow"><p>El flujo preventivo detallado requiere desplegar y habilitar la migración 16.</p></div>

  const activities = activitiesText.split(/\r?\n/).map((activity) => activity.trim()).filter(Boolean)

  async function save(finalize: boolean) {
    setSaving(true); setError(""); setMessage("")
    try {
      const finalCompletedAt = finalize ? (completedAt || nowLocalInput()) : null
      await savePreventiveIntervention(item.id, {
        startedAt: new Date(startedAt).toISOString(),
        completedAt: finalCompletedAt ? new Date(finalCompletedAt).toISOString() : null,
        diagnosis, workPerformed, testResults,
        equipmentCondition: condition || null,
        technicalNotes,
        activities: activities.map((activity) => ({ activity, completed: finalize, notes: "" })),
      })
      setCompletedAt(finalCompletedAt || "")
      setMessage(finalize ? "Mantenimiento enviado para validación." : "Borrador preventivo guardado.")
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible guardar el mantenimiento preventivo.")
    } finally { setSaving(false) }
  }

  async function close() {
    setSaving(true); setError(""); setMessage("")
    try {
      await validatePreventiveClosure(item.id, closureNotes)
      setMessage("Mantenimiento preventivo validado y próxima fecha actualizada cuando existe periodicidad aprobada.")
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible validar el cierre preventivo.")
    } finally { setSaving(false) }
  }

  return (
    <section className="corrective-workflow">
      <div className="corrective-summary">
        <strong>Rutina preventiva</strong>
        <span>Técnico asignado: {item.assigned_to_name || "No disponible"}</span>
        {item.equipment && <span>Equipo: {item.equipment.inventory_code} · {item.equipment.equipment_type} · {item.equipment.hospital_area}</span>}
      </div>
      {role === "tecnico" && item.status === "programado" && <p>Inicia la orden antes de registrar la rutina.</p>}
      {role === "tecnico" && item.status === "en_proceso" && (
        <div className="corrective-form">
          <label><span>Inicio *</span><input type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} /></label>
          <label><span>Finalización</span><input type="datetime-local" value={completedAt} onChange={(event) => setCompletedAt(event.target.value)} /></label>
          <label className="span-2"><span>Actividades ejecutadas, una por línea *</span><textarea value={activitiesText} onChange={(event) => setActivitiesText(event.target.value)} /></label>
          <label className="span-2"><span>Hallazgos / diagnóstico *</span><textarea value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} /></label>
          <label className="span-2"><span>Trabajo realizado *</span><textarea value={workPerformed} onChange={(event) => setWorkPerformed(event.target.value)} /></label>
          <label className="span-2"><span>Resultados de pruebas *</span><textarea value={testResults} onChange={(event) => setTestResults(event.target.value)} /></label>
          <label><span>Condición final *</span><select value={condition} onChange={(event) => setCondition(event.target.value as typeof condition)}><option value="">Seleccionar</option><option value="operativo">Operativo</option><option value="en_reparacion">En reparación</option><option value="fuera_de_servicio">Fuera de servicio</option></select></label>
          <label className="span-2"><span>Observaciones</span><textarea value={technicalNotes} onChange={(event) => setTechnicalNotes(event.target.value)} /></label>
          <div className="corrective-actions"><button type="button" className="row-action" disabled={saving || !startedAt} onClick={() => save(false)}>Guardar borrador</button><button type="button" className="row-action" disabled={saving || !startedAt || activities.length === 0} onClick={() => save(true)}>Enviar para validación</button></div>
        </div>
      )}
      {record && role === "jefe" && <div className="technical-record-summary"><strong>Expediente preventivo</strong><span>Inicio: {record.started_at ? formatDate(record.started_at) : "Pendiente"}</span><span>Finalización: {record.completed_at ? formatDate(record.completed_at) : "Pendiente"}</span><p><b>Hallazgos:</b> {record.diagnosis || "Pendiente"}</p><p><b>Trabajo:</b> {record.work_performed || "Pendiente"}</p><p><b>Pruebas:</b> {record.test_results || "Pendiente"}</p>{(item.activities || []).map((activity) => <p key={activity.id}><b>Actividad:</b> {activity.activity} · {activity.completed ? "completada" : "pendiente"}</p>)}</div>}
      {role === "jefe" && item.status === "en_proceso" && <div className="closure-panel"><label><span>Observaciones de validación</span><textarea value={closureNotes} onChange={(event) => setClosureNotes(event.target.value)} /></label><button type="button" className="row-action" disabled={saving || !record?.completed_at} onClick={close}>Validar preventivo</button></div>}
      <AttachmentPanel maintenanceId={item.id} attachments={item.attachments || []} onChanged={onChanged} />
      {message && <p className="form-success" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}

function AttachmentPanel({ maintenanceId, attachments, onChanged }: { maintenanceId: number; attachments: FileAttachment[]; onChanged: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function upload() {
    if (!file) return
    setBusy(true); setError("")
    try {
      await uploadPrivateAttachment(file, { maintenanceId }, description)
      setFile(null); setDescription(""); onChanged()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible subir el archivo.") }
    finally { setBusy(false) }
  }

  async function download(attachment: FileAttachment) {
    setError("")
    try { window.open(await createAttachmentDownloadUrl(attachment), "_blank", "noopener,noreferrer") }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible abrir el archivo.") }
  }

  async function remove(attachment: FileAttachment) {
    if (!window.confirm(`¿Desactivar ${attachment.original_name}?`)) return
    setBusy(true); setError("")
    try { await deletePrivateAttachment(attachment.id); onChanged() }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible eliminar la evidencia.") }
    finally { setBusy(false) }
  }

  return <div className="attachment-panel"><strong>Evidencias privadas</strong><div className="attachment-upload"><input aria-label="Archivo de evidencia" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.doc,.docx" onChange={(event) => setFile(event.target.files?.[0] || null)} /><input aria-label="Descripción de evidencia" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descripción" /><button type="button" className="row-action" disabled={!file || busy} onClick={upload}><Upload size={15} /> {busy ? "Subiendo..." : "Subir"}</button></div>{attachments.map((attachment) => <div className="attachment-row" key={attachment.id}><button type="button" className="attachment-link" onClick={() => download(attachment)}>{attachment.original_name} · {(attachment.size_bytes / 1024).toFixed(1)} KB</button><button type="button" className="row-action" disabled={busy} onClick={() => remove(attachment)}>Eliminar</button></div>)}{error && <small className="form-error" role="alert">{error}</small>}</div>
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
