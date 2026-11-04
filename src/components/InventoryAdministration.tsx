import { useEffect, useMemo, useState, type FormEvent } from "react"
import { AlertTriangle, CalendarPlus, CheckCircle2, Save, Settings2 } from "lucide-react"
import {
  configureEquipmentPreventiveProgram,
  getInventoryAdministrationData,
  isInventoryAdministrationEnabled,
  reviewInventoryIssue,
  schedulePreventiveMaintenance,
  updateEquipmentAssetAdmin,
  type EquipmentInventoryBundle,
  type EquipmentProgramConfiguration,
  type InventoryAdminAsset,
  type InventoryAdministrationData,
  type InventoryIssue,
} from "../lib/supabase"

export const issueLabels: Record<string, string> = {
  duplicate_serial: "Número de serie compartido o duplicado, pendiente de verificar",
  duplicate_asset_signature: "Datos de identificación coincidentes",
  maintenance_periodicity_missing: "Periodicidad de mantenimiento sin definir",
  invalid_document_url: "Enlace documental no válido",
  location_case_variant: "Variación de escritura en la ubicación",
  missing_specific_location: "Ubicación específica no registrada",
  missing_user_manual: "Manual de usuario no registrado",
  risk_total_hardcoded: "Total de riesgo escrito como valor",
  same_manual_url: "El mismo enlace aparece en más de un tipo de manual",
  serial_placeholder: "Número de serie provisional",
  spelling_candidate: "Texto posiblemente inconsistente",
}

export function inventoryIssueLabel(code: string) {
  return issueLabels[code] || code.replace(/_/g, " ")
}

export type InventoryAdministrationApi = {
  load: typeof getInventoryAdministrationData
  updateAsset: typeof updateEquipmentAssetAdmin
  configureProgram: typeof configureEquipmentPreventiveProgram
  schedule: typeof schedulePreventiveMaintenance
  reviewIssue: typeof reviewInventoryIssue
}

const defaultApi: InventoryAdministrationApi = {
  load: getInventoryAdministrationData,
  updateAsset: updateEquipmentAssetAdmin,
  configureProgram: configureEquipmentPreventiveProgram,
  schedule: schedulePreventiveMaintenance,
  reviewIssue: reviewInventoryIssue,
}

function nullableNumber(value: string) {
  return value === "" ? null : Number(value)
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "No fue posible completar la operación."
}

function AssetEditor({ data, onSave }: {
  data: InventoryAdministrationData
  onSave: (asset: InventoryAdminAsset) => Promise<void>
}) {
  const [asset, setAsset] = useState(data.asset)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const locations = data.locations.filter((item) => item.hospital_area_id === asset.hospital_area_id)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage("")
    try {
      await onSave(asset)
      setMessage("Cambios guardados y registrados en auditoría.")
    } catch (error) {
      setMessage(messageOf(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="panel inventory-admin-card" onSubmit={submit}>
      <h3><Settings2 size={18} /> Administración del equipo</h3>
      <p>Se conservan el código, fabricante, modelo y datos originales de importación.</p>
      <div className="form-grid">
        <label className="field"><span>Número de serie</span><input value={asset.serial_number || ""} onChange={(e) => setAsset({ ...asset, serial_number: e.target.value || null })} /></label>
        <label className="field"><span>Estado</span><select value={asset.status} onChange={(e) => setAsset({ ...asset, status: e.target.value as InventoryAdminAsset["status"] })}><option value="desconocido">Sin confirmar</option><option value="operativo">Operativo</option><option value="en_reparacion">En reparación</option><option value="fuera_de_servicio">Fuera de servicio</option><option value="baja">Baja</option></select></label>
        <label className="field"><span>Año de fabricación</span><input type="number" min="1950" max="2100" value={asset.manufacture_year ?? ""} onChange={(e) => setAsset({ ...asset, manufacture_year: nullableNumber(e.target.value) })} /></label>
        <label className="field"><span>Año de adquisición</span><input type="number" min="1950" max="2100" value={asset.acquisition_year ?? ""} onChange={(e) => setAsset({ ...asset, acquisition_year: nullableNumber(e.target.value) })} /></label>
        <label className="field"><span>Área hospitalaria</span><select value={asset.hospital_area_id} onChange={(e) => setAsset({ ...asset, hospital_area_id: Number(e.target.value), location_id: null })}>{data.areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
        <label className="field"><span>Ubicación específica</span><select value={asset.location_id ?? ""} onChange={(e) => setAsset({ ...asset, location_id: nullableNumber(e.target.value) })}><option value="">Sin ubicación específica</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <label className="field"><span>Resguardo</span><input value={asset.custodian_location_text || ""} onChange={(e) => setAsset({ ...asset, custodian_location_text: e.target.value || null })} /></label>
        <label className="check-inline"><input type="checkbox" checked={asset.serial_is_placeholder} onChange={(e) => setAsset({ ...asset, serial_is_placeholder: e.target.checked })} /> Serie provisional o pendiente de confirmar</label>
      </div>
      {message && <p className="inventory-admin-message" role="status">{message}</p>}
      <button className="btn btn-primary" disabled={saving} type="submit"><Save size={17} /> {saving ? "Guardando..." : "Guardar cambios"}</button>
    </form>
  )
}

function PreventiveEditor({ equipmentId, bundle, data, api, onChanged }: {
  equipmentId: string
  bundle: EquipmentInventoryBundle
  data: InventoryAdministrationData
  api: InventoryAdministrationApi
  onChanged: () => Promise<void>
}) {
  const firstProgram = data.programs[0]
  const [programId, setProgramId] = useState(firstProgram?.maintenance_program_id ?? 0)
  const selected = data.programs.find((item) => item.maintenance_program_id === programId) || firstProgram
  const [form, setForm] = useState<EquipmentProgramConfiguration | null>(selected || null)
  const [scheduledAt, setScheduledAt] = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const [priority, setPriority] = useState<"critica" | "alta" | "ordinaria">("ordinaria")
  const [message, setMessage] = useState("")
  const programName = (id: number) => bundle.programs.find((item) => item.id === id)?.name || `Rutina ${id}`

  useEffect(() => {
    const next = data.programs.find((item) => item.maintenance_program_id === programId) || null
    setForm(next)
  }, [data.programs, programId])

  if (!form) return <section className="panel inventory-admin-card"><h3>Mantenimiento preventivo</h3><p>No hay una rutina vinculada que pueda configurarse.</p></section>

  async function saveConfiguration(event: FormEvent) {
    event.preventDefault()
    setMessage("")
    if (form!.interval_months && !form!.periodicity_basis?.trim()) {
      setMessage("Indica el fundamento de la periodicidad.")
      return
    }
    try {
      await api.configureProgram(equipmentId, form!)
      await onChanged()
      setMessage("Periodicidad específica del equipo guardada.")
    } catch (error) { setMessage(messageOf(error)) }
  }

  async function schedule(event: FormEvent) {
    event.preventDefault()
    setMessage("")
    if (!scheduledAt) { setMessage("Selecciona fecha y hora."); return }
    try {
      await api.schedule({ equipmentId, programId, scheduledAt: new Date(scheduledAt).toISOString(), assignedTo: assignedTo || null, priority })
      setMessage("Orden preventiva creada. Ya aparecerá en mantenimiento y calendario.")
    } catch (error) { setMessage(messageOf(error)) }
  }

  return (
    <section className="panel inventory-admin-card">
      <h3><CalendarPlus size={18} /> Mantenimiento preventivo</h3>
      <label className="field"><span>Rutina vinculada</span><select value={programId} onChange={(e) => setProgramId(Number(e.target.value))}>{data.programs.map((item) => <option key={item.maintenance_program_id} value={item.maintenance_program_id}>{programName(item.maintenance_program_id)}</option>)}</select></label>
      <form onSubmit={saveConfiguration}>
        <div className="form-grid">
          <label className="field"><span>Periodicidad (meses)</span><input type="number" min="1" value={form.interval_months ?? ""} onChange={(e) => setForm({ ...form, interval_months: nullableNumber(e.target.value) })} /></label>
          <label className="field"><span>Fundamento</span><input placeholder="Manual, política o criterio aprobado" value={form.periodicity_basis || ""} onChange={(e) => setForm({ ...form, periodicity_basis: e.target.value || null })} /></label>
          <label className="field"><span>Fecha de referencia</span><input type="date" value={form.reference_date || ""} onChange={(e) => setForm({ ...form, reference_date: e.target.value || null })} /></label>
          <label className="field"><span>Último mantenimiento</span><input type="date" value={form.last_completed_on || ""} onChange={(e) => setForm({ ...form, last_completed_on: e.target.value || null })} /></label>
        </div>
        <label className="field"><span>Notas</span><textarea value={form.periodicity_notes || ""} onChange={(e) => setForm({ ...form, periodicity_notes: e.target.value || null })} /></label>
        <p>Próximo vencimiento: <strong>{form.next_due_on || "Se calculará al guardar si existe una fecha base"}</strong></p>
        <button className="btn btn-secondary" type="submit"><Save size={17} /> Guardar periodicidad</button>
      </form>
      <form className="inventory-schedule-form" onSubmit={schedule}>
        <h4>Crear orden preventiva</h4>
        <div className="form-grid">
          <label className="field"><span>Fecha y hora</span><input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></label>
          <label className="field"><span>Técnico</span><select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}><option value="">Sin asignar</option>{data.technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.full_name}</option>)}</select></label>
          <label className="field"><span>Prioridad</span><select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}><option value="ordinaria">Ordinaria</option><option value="alta">Alta</option><option value="critica">Crítica</option></select></label>
        </div>
        <button className="btn btn-primary" type="submit"><CalendarPlus size={17} /> Programar mantenimiento</button>
      </form>
      {message && <p className="inventory-admin-message" role="status">{message}</p>}
    </section>
  )
}

function IssueReview({ issue, reviews, api, onChanged }: {
  issue: InventoryIssue
  reviews: InventoryAdministrationData["issueReviews"]
  api: InventoryAdministrationApi
  onChanged: () => Promise<void>
}) {
  const [status, setStatus] = useState<"confirmado" | "corregido" | "descartado">("confirmado")
  const [notes, setNotes] = useState("")
  const [justification, setJustification] = useState("")
  const [evidence, setEvidence] = useState("")
  const [message, setMessage] = useState("")
  const history = reviews.filter((review) => review.issue_id === issue.id)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!notes.trim() || !justification.trim()) { setMessage("Las observaciones y la justificación son obligatorias."); return }
    try {
      await api.reviewIssue({ issueId: issue.id, status, notes, justification, evidenceReference: evidence || null })
      await onChanged()
      setMessage("Revisión registrada sin eliminar la incidencia original.")
    } catch (error) { setMessage(messageOf(error)) }
  }

  return (
    <article className="inventory-issue-review">
      <strong>{inventoryIssueLabel(issue.issue_code)}</strong>
      <p>{issue.details}</p>
      <span>Estado: {issue.review_status}</span>
      {history.length > 0 && <details><summary>Historial ({history.length})</summary>{history.map((review) => <p key={review.id}><b>{review.review_status}</b> · {new Date(review.reviewed_at).toLocaleString("es-MX")}<br />{review.notes}<br /><small>{review.justification}</small></p>)}</details>}
      <form onSubmit={submit}>
        <label className="field"><span>Resultado</span><select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="confirmado">Confirmado</option><option value="corregido">Corregido</option><option value="descartado">Descartado</option></select></label>
        <label className="field"><span>Observaciones</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <label className="field"><span>Justificación</span><textarea value={justification} onChange={(e) => setJustification(e.target.value)} /></label>
        <label className="field"><span>Referencia de evidencia (opcional)</span><input value={evidence} onChange={(e) => setEvidence(e.target.value)} /></label>
        <button className="btn btn-secondary" type="submit"><CheckCircle2 size={17} /> Registrar revisión</button>
      </form>
      {message && <p className="inventory-admin-message" role="status">{message}</p>}
    </article>
  )
}

export function InventoryAdministration({ bundle, enabled = isInventoryAdministrationEnabled, api = defaultApi, onChanged }: {
  bundle: EquipmentInventoryBundle
  enabled?: boolean
  api?: InventoryAdministrationApi
  onChanged: () => void
}) {
  const [data, setData] = useState<InventoryAdministrationData | null>(null)
  const [error, setError] = useState("")
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let active = true
    api.load(bundle.equipment.id).then((result) => { if (active) setData(result) }).catch((loadError) => { if (active) setError(messageOf(loadError)) })
    return () => { active = false }
  }, [api, bundle.equipment.id, enabled, reload])

  const refresh = useMemo(() => async () => {
    setReload((value) => value + 1)
    onChanged()
  }, [onChanged])

  if (!enabled) return (
    <section className="panel inventory-admin-disabled" role="status">
      <AlertTriangle size={22} />
      <div><strong>Administración preparada, pendiente de aprobación</strong><p>La consulta continúa activa, pero editar, programar y revisar se habilitarán únicamente después de desplegar <code>13_inventory_administration.sql</code>.</p></div>
    </section>
  )
  if (error) return <section className="panel inventory-admin-disabled" role="alert"><AlertTriangle size={22} /><div><strong>No fue posible cargar la administración</strong><p>{error}</p></div></section>
  if (!data) return <section className="panel inventory-admin-disabled"><Settings2 size={22} /><div><strong>Cargando herramientas administrativas...</strong></div></section>

  return (
    <div className="inventory-admin-layout">
      <AssetEditor data={data} onSave={async (asset) => { await api.updateAsset(asset); await refresh() }} />
      <PreventiveEditor equipmentId={bundle.equipment.id} bundle={bundle} data={data} api={api} onChanged={refresh} />
      <section className="panel inventory-admin-card inventory-review-panel">
        <h3>Revisión de incidencias</h3>
        <p>Los registros dudosos se conservan; cada decisión agrega una entrada al historial.</p>
        {bundle.issues.length === 0 ? <p>Este equipo no tiene incidencias registradas.</p> : bundle.issues.map((issue) => <IssueReview key={issue.id} issue={issue} reviews={data.issueReviews} api={api} onChanged={refresh} />)}
      </section>
    </div>
  )
}
