import { useEffect, useState } from "react"
import { Bell, Building2, CheckCheck, UserRound } from "lucide-react"

import {
  getInstitutionSettings,
  getProfileActivity,
  changeOwnPassword,
  checkStorageIntegrity,
  isOperationalCompletionEnabled,
  isBusinessCompletionEnabled,
  listNotifications,
  markNotificationRead,
  updateInstitutionSettings,
  updateOwnProfile,
  type InstitutionSettings,
  type Notification,
  type Profile,
  type ActivityTimelineEntry,
} from "../lib/supabase"
import { Button, PageIntro } from "./ui"

function PendingMigration({ title }: { title: string }) {
  return <><PageIntro title={title} description="Esta función está preparada, pero permanece deshabilitada hasta instalar la migración 16." /><section className="panel empty-state"><h3>Activación pendiente</h3><p>No se realizó ninguna operación sobre producción.</p></section></>
}

export function NotificationsView() {
  const [rows, setRows] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  function load() {
    setLoading(true)
    setError("")
    listNotifications().then(setRows).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "No fue posible cargar las notificaciones.")).finally(() => setLoading(false))
  }
  useEffect(load, [])

  if (!isOperationalCompletionEnabled) return <PendingMigration title="Notificaciones" />

  async function toggle(row: Notification) {
    try {
      const updated = await markNotificationRead(row.id, !row.read_at)
      setRows((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible actualizar la notificación.")
    }
  }

  return <><PageIntro title="Notificaciones" description="Eventos persistentes visibles únicamente para tu cuenta." /><section className="panel"><div className="panel-head"><div><h3>Bandeja personal</h3><p>{rows.filter((row) => !row.read_at).length} sin leer</p></div><Bell size={21} /></div>{error && <p className="form-error" role="alert">{error}</p>}{loading ? <div className="empty-state"><h3>Cargando notificaciones...</h3></div> : rows.length === 0 ? <div className="empty-state"><h3>No hay notificaciones</h3><p>Los cambios de reportes y mantenimiento aparecerán aquí.</p></div> : <div className="notice-list">{rows.map((row) => <article key={row.id} className={row.read_at ? "notification-read" : "notification-unread"}><span className="summary-icon blue"><Bell size={18} /></span><div><strong>{row.title}</strong><p>{row.message}</p><small>{new Date(row.created_at).toLocaleString("es-MX")}</small></div><button type="button" className="row-action" onClick={() => toggle(row)}><CheckCheck size={15} />{row.read_at ? "Marcar pendiente" : "Marcar leída"}</button></article>)}</div>}</section></>
}

export function InstitutionSettingsView() {
  const [settings, setSettings] = useState<InstitutionSettings | null>(null)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [integrity, setIntegrity] = useState<{ missingObjects: Array<{ id: string; storage_path: string }>; orphanObjects: string[] } | null>(null)
  useEffect(() => { if (isOperationalCompletionEnabled) getInstitutionSettings().then(setSettings).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "No fue posible cargar la configuración.")) }, [])

  if (!isOperationalCompletionEnabled) return <PendingMigration title="Configuración institucional" />

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!settings) return
    setSaving(true); setSaved(false); setError("")
    try { setSettings(await updateInstitutionSettings(settings)); setSaved(true) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible guardar la configuración.") }
    finally { setSaving(false) }
  }

  return <><PageIntro title="Configuración institucional" description="Parámetros operativos públicos de la institución; no contiene secretos de Supabase." />{!settings ? <section className="panel empty-state"><Building2 size={32} /><h3>{error || "Cargando configuración..."}</h3></section> : <form className="panel training-form" onSubmit={save}><div className="form-grid"><label className="field span-2"><span>Nombre de la institución</span><input required value={settings.institution_name} onChange={(event) => setSettings({ ...settings, institution_name: event.target.value })} /></label><label className="field"><span>Zona horaria</span><input required value={settings.timezone} onChange={(event) => setSettings({ ...settings, timezone: event.target.value })} /></label><label className="field"><span>Moneda predeterminada</span><input required maxLength={3} value={settings.default_currency} onChange={(event) => setSettings({ ...settings, default_currency: event.target.value.toUpperCase() })} /></label><label className="field"><span>Aviso preventivo (días)</span><input required type="number" min="0" max="365" value={settings.preventive_warning_days} onChange={(event) => setSettings({ ...settings, preventive_warning_days: Number(event.target.value) })} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}{saved && <p className="form-success">Configuración guardada y auditada.</p>}<div className="form-footer"><Button type="submit">{saving ? "Guardando..." : "Guardar configuración"}</Button></div></form>}<section className="panel"><div className="panel-head"><div><h3>Integridad de Storage</h3><p>Compara objetos privados y metadatos sin exponer la clave administrativa.</p></div><Button variant="secondary" onClick={async () => { setError(""); try { setIntegrity(await checkStorageIntegrity()) } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible verificar Storage.") } }}>Verificar</Button></div>{integrity && <div><p>Metadatos sin objeto: {integrity.missingObjects.length}</p><p>Objetos huérfanos: {integrity.orphanObjects.length}</p></div>}</section></>
}

export function ProfileView({ profile, onUpdated }: { profile: Profile; onUpdated: (profile: Profile) => void }) {
  const [fullName, setFullName] = useState(profile.full_name)
  const [department, setDepartment] = useState(profile.department || "")
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activity, setActivity] = useState<ActivityTimelineEntry[]>([])
  useEffect(() => { if (isBusinessCompletionEnabled) getProfileActivity().then(setActivity).catch(() => setActivity([])) }, [profile.id])
  if (!isOperationalCompletionEnabled) return <PendingMigration title="Mi perfil" />
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setSaved(false)
    try { const updated = await updateOwnProfile(fullName, department); onUpdated(updated); setSaved(true) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible actualizar el perfil.") }
    finally { setSaving(false) }
  }
  return <><PageIntro title="Mi perfil" description="Puedes editar tus datos personales. Tu rol y estado requieren autorización de un jefe." /><form className="panel training-form" onSubmit={save}><div className="panel-head"><div><h3>{profile.institutional_id}</h3><p>Rol: {profile.role} · {profile.active ? "Activo" : "Inactivo"}</p></div><UserRound size={22} /></div><div className="form-grid"><label className="field span-2"><span>Nombre completo</span><input required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label><label className="field span-2"><span>Departamento</span><input value={department} onChange={(event) => setDepartment(event.target.value)} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}{saved && <p className="form-success">Perfil actualizado.</p>}<div className="form-footer"><Button type="submit">{saving ? "Guardando..." : "Guardar perfil"}</Button></div></form><section className="panel"><div className="panel-head"><div><h3>Mi actividad</h3><p>Reportes, asignaciones, mantenimientos y cambios persistidos.</p></div></div><div className="audit-list">{activity.map((row, index) => <article key={`${row.event_type}-${row.reference}-${index}`}><div><strong>{row.reference} · {row.event_type}</strong><small>{new Date(row.event_time).toLocaleString("es-MX")} · {row.description}</small></div></article>)}</div>{activity.length === 0 && <div className="empty-state"><h3>Sin actividad visible</h3></div>}</section></>
}

export function PasswordChangeGate({ onCompleted }: { onCompleted: (profile: Profile) => void }) {
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("")
    if (password !== confirmation) { setError("Las contraseñas no coinciden."); return }
    setSaving(true)
    try { onCompleted(await changeOwnPassword(password)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible cambiar la contraseña.") }
    finally { setSaving(false) }
  }
  return <div className="modal-layer password-gate"><form className="modal" onSubmit={submit}><div className="modal-head"><div><span className="eyebrow">Seguridad de la cuenta</span><h2>Cambia tu contraseña temporal</h2><p>Debes completar este paso antes de utilizar BioMedGest.</p></div></div><label className="field"><span>Nueva contraseña</span><input required type="password" minLength={12} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="field"><span>Confirmar contraseña</span><input required type="password" minLength={12} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<Button type="submit">{saving ? "Actualizando..." : "Cambiar contraseña"}</Button></form></div>
}
