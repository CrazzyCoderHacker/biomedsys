import { useEffect, useState } from "react"

import { AlertTriangle, History, Search, UserPlus, Users } from "lucide-react"

import { Button, PageIntro } from "./ui"
import { PrivateAttachmentPanel } from "./PrivateAttachmentPanel"

import {
  createQuote,
  createAccessRequest,
  listAuditLog,
  listAccessRequests,
  listQuoteItems,
  listQuoteStatusHistory,
  listEquipmentInventory,
  listMaintenanceOverview,
  listProfiles,
  listProfileChangeHistory,
  listQuotes,
  isOperationalCompletionEnabled,
  manageProfile,
  provisionUser,
  isBusinessCompletionEnabled,
  saveQuoteItems,
  syncAuthStatus,
  type AuditEntry,
  type AccessRequest,
  type Profile,
  type ProfileChange,
  type Quote,
  type QuoteItem,
  type QuoteStatusHistory,
  type EquipmentInventoryDetail,
  type MaintenanceSummary,
} from "../lib/supabase"

export function QuotationsView() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [error, setError] = useState("")

  const [open, setOpen] = useState(false)

  useEffect(() => {
    listQuotes()
      .then(setQuotes)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "No fue posible cargar cotizaciones.",
        ),
      )
  }, [])

  return (
    <>
      <PageIntro
        title="Cotizaciones"
        description="Solicita y revisa cotizaciones de equipo médico con proveedores."
        action={
          <Button icon={UserPlus} onClick={() => setOpen(true)}>
            Nueva cotización
          </Button>
        }
      />
      {open && (
        <QuoteForm
          onCancel={() => setOpen(false)}
          onCreated={(quote) => {
            setQuotes((current) => [quote, ...current])
            setOpen(false)
          }}
        />
      )}
      <section className="panel">
        {error && <QueryError message={error} />}
        {!error && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Proveedor</th>
                    <th>Equipo</th>
                    <th>Monto</th>
                    <th>Estado</th>
                    {isBusinessCompletionEnabled && <th>Detalle</th>}
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((quote) => (
                    <tr key={quote.id}>
                      <td>
                        <strong className="order-id">
                          {quote.quote_number}
                        </strong>
                      </td>
                      <td>{quote.supplier}</td>
                      <td>{quote.equipment_description}</td>
                      <td>
                        {quote.currency} {quote.amount.toLocaleString("es-MX")}
                      </td>
                      {isBusinessCompletionEnabled && <td><QuoteDetailEditor quote={quote} onChanged={(updated) => setQuotes((current) => current.map((item) => item.id === updated.id ? updated : item))} /></td>}
                      <td>
                        <span className="badge badge-warning">
                          {quote.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {quotes.length === 0 && (
              <div className="empty-state">
                <h3>No hay cotizaciones registradas</h3>
                <p>Agrega la primera cotización para iniciar la revisión.</p>
              </div>
            )}
          </>
        )}
      </section>
    </>
  )
}

function QuoteForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated: (quote: Quote) => void
}) {
  const [supplier, setSupplier] = useState("")
  const [equipmentDescription, setEquipmentDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<QuoteItem[]>([{ description: "", quantity: 1, unit_cost: 0 }])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSaving(true)
    try {
      let created = await createQuote({
          supplier,
          equipmentDescription,
          amount: isBusinessCompletionEnabled ? items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0) : Number(amount),
          notes,
        })
      if (isBusinessCompletionEnabled) created = await saveQuoteItems(created.id, created.status, items)
      onCreated(created)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible guardar la cotización.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="panel training-form" onSubmit={submit}>
      <div className="panel-head">
        <h3>Nueva cotización</h3>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Proveedor *</span>
          <input
            required
            value={supplier}
            onChange={(event) => setSupplier(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Monto MXN *</span>
          <input
            required
            type="number"
            min="0"
            value={isBusinessCompletionEnabled ? items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0) : amount}
            onChange={(event) => setAmount(event.target.value)}
            readOnly={isBusinessCompletionEnabled}
          />
        </label>
        <label className="field span-2">
          <span>Equipo o servicio *</span>
          <input
            required
            value={equipmentDescription}
            onChange={(event) => setEquipmentDescription(event.target.value)}
          />
        </label>
        <label className="field span-2">
          <span>Notas</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
      </div>
      {isBusinessCompletionEnabled && <div className="quote-items"><strong>Conceptos</strong>{items.map((item, index) => <div className="quote-item-row" key={index}><input required aria-label={`Concepto ${index + 1}`} placeholder="Descripción" value={item.description} onChange={(event) => setItems((current) => current.map((row, position) => position === index ? { ...row, description: event.target.value } : row))} /><input required aria-label={`Cantidad ${index + 1}`} type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => setItems((current) => current.map((row, position) => position === index ? { ...row, quantity: Number(event.target.value) } : row))} /><input required aria-label={`Costo ${index + 1}`} type="number" min="0" step="0.01" value={item.unit_cost} onChange={(event) => setItems((current) => current.map((row, position) => position === index ? { ...row, unit_cost: Number(event.target.value) } : row))} />{items.length > 1 && <button type="button" className="row-action" onClick={() => setItems((current) => current.filter((_, position) => position !== index))}>Quitar</button>}</div>)}<button type="button" className="row-action" onClick={() => setItems((current) => [...current, { description: "", quantity: 1, unit_cost: 0 }])}>Agregar concepto</button></div>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-footer">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          {saving ? "Guardando..." : "Guardar cotización"}
        </Button>
      </div>
    </form>
  )
}

function QuoteDetailEditor({ quote, onChanged }: { quote: Quote; onChanged: (quote: Quote) => void }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<QuoteItem[]>([])
  const [status, setStatus] = useState(quote.status)
  const [error, setError] = useState("")
  const [equipment, setEquipment] = useState<EquipmentInventoryDetail[]>([])
  const [maintenances, setMaintenances] = useState<MaintenanceSummary[]>([])
  const [equipmentId, setEquipmentId] = useState(quote.equipment_id || "")
  const [maintenanceId, setMaintenanceId] = useState(quote.maintenance_id ? String(quote.maintenance_id) : "")
  const [history, setHistory] = useState<QuoteStatusHistory[]>([])
  const locked = quote.status === "aprobada" || quote.status === "rechazada"
  async function toggle() { const next = !open; setOpen(next); if (next) { try { const [rows, equipmentRows, maintenanceResult, historyRows] = await Promise.all([listQuoteItems(quote.id), listEquipmentInventory("jefe"), listMaintenanceOverview(), listQuoteStatusHistory(quote.id)]); setItems(rows.length ? rows : [{ description: quote.equipment_description, quantity: 1, unit_cost: quote.amount }]); setEquipment(equipmentRows); setMaintenances(maintenanceResult.maintenances); setHistory(historyRows) } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible cargar el detalle.") } } }
  async function save() { try { const updated = await saveQuoteItems(quote.id, status, items, { equipmentId: equipmentId || null, maintenanceId: maintenanceId ? Number(maintenanceId) : null }); onChanged(updated); setOpen(false) } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible guardar la cotización.") } }
  return <div><button type="button" className="row-action" onClick={toggle}>{open ? "Cerrar" : locked ? "Consultar" : "Editar"}</button>{open && <div className="quote-detail-editor"><label className="field"><span>Estado</span><select disabled={locked} value={status} onChange={(event) => setStatus(event.target.value)}><option value="pendiente">Pendiente</option><option value="en_revision">En revisión</option><option value="aprobada">Aprobada</option><option value="rechazada">Rechazada</option></select></label><label className="field"><span>Equipo relacionado</span><select disabled={locked || Boolean(maintenanceId)} value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)}><option value="">Sin equipo</option>{equipment.map((row) => <option key={row.id} value={row.id}>{row.inventory_code} · {row.equipment_type}</option>)}</select></label><label className="field"><span>Mantenimiento relacionado</span><select disabled={locked || Boolean(equipmentId)} value={maintenanceId} onChange={(event) => setMaintenanceId(event.target.value)}><option value="">Sin mantenimiento</option>{maintenances.map((row) => <option key={row.id} value={row.id}>{row.maintenance_number}</option>)}</select></label>{items.map((item, index) => <div className="quote-item-row" key={item.id || index}><input disabled={locked} value={item.description} onChange={(event) => setItems((current) => current.map((row, position) => position === index ? { ...row, description: event.target.value } : row))} /><input disabled={locked} type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => setItems((current) => current.map((row, position) => position === index ? { ...row, quantity: Number(event.target.value) } : row))} /><input disabled={locked} type="number" min="0" step="0.01" value={item.unit_cost} onChange={(event) => setItems((current) => current.map((row, position) => position === index ? { ...row, unit_cost: Number(event.target.value) } : row))} /></div>)}{!locked && <><button type="button" className="row-action" onClick={() => setItems((current) => [...current, { description: "", quantity: 1, unit_cost: 0 }])}>Agregar</button><button type="button" className="row-action" onClick={save}>Guardar</button></>}<div className="audit-list">{history.map((row) => <small key={row.id}>{row.previous_status} → {row.new_status} · {new Date(row.changed_at).toLocaleString("es-MX")}</small>)}</div><PrivateAttachmentPanel relation={{ quoteId: quote.id }} title="Documentos de cotización" />{error && <small className="form-error">{error}</small>}</div>}</div>
}

export function UserPermissionsView() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [role, setRole] = useState("")
  const [active, setActive] = useState("")
  const [editing, setEditing] = useState<Profile | null>(null)
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [request, setRequest] = useState({ institutionalId: "", fullName: "", role: "usuario" as Profile["role"], department: "" })
  const [provisioning, setProvisioning] = useState<AccessRequest | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState("")

  useEffect(() => {
    listProfiles()
      .then(setProfiles)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "No fue posible cargar perfiles.",
        ),
      )
  }, [])
  useEffect(() => { if (isOperationalCompletionEnabled) listAccessRequests().then(setRequests).catch(() => undefined) }, [])

  const filtered = profiles.filter((profile) => {
    const term = search.trim().toLocaleLowerCase("es-MX")
    return (!term || [profile.full_name, profile.institutional_id, profile.department || ""].some((value) => value.toLocaleLowerCase("es-MX").includes(term))) &&
      (!role || profile.role === role) && (!active || String(profile.active) === active)
  })

  async function saveProfile() {
    if (!editing || !reason.trim()) {
      setError("Indica el motivo del cambio para conservar la trazabilidad.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const previous = profiles.find((profile) => profile.id === editing.id)
      const updated = await manageProfile(editing, reason.trim())
      setProfiles((current) => current.map((profile) => profile.id === updated.id ? updated : profile))
      if (previous && previous.active !== updated.active) {
        try { await syncAuthStatus(updated.id, updated.active) }
        catch (cause) {
          setError(`El perfil quedó ${updated.active ? "activo" : "inactivo"} y RLS ya aplica, pero Auth no pudo sincronizarse: ${cause instanceof Error ? cause.message : "error no identificado"}`)
          return
        }
      }
      setEditing(null)
      setReason("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible actualizar el perfil.")
    } finally {
      setSaving(false)
    }
  }

  async function submitAccessRequest(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("")
    try { await createAccessRequest(request); setRequests(await listAccessRequests()); setRequestOpen(false); setRequest({ institutionalId: "", fullName: "", role: "usuario", department: "" }) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible registrar la solicitud.") }
    finally { setSaving(false) }
  }

  async function submitProvision(event: React.FormEvent) {
    event.preventDefault(); if (!provisioning) return
    setSaving(true); setError("")
    try {
      await provisionUser({ institutionalId: provisioning.institutional_id, fullName: provisioning.full_name, role: provisioning.role, department: provisioning.department || "", temporaryPassword, accessRequestId: provisioning.id })
      const [profileRows, requestRows] = await Promise.all([listProfiles(), listAccessRequests()])
      setProfiles(profileRows); setRequests(requestRows); setProvisioning(null); setTemporaryPassword("")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible crear la cuenta.") }
    finally { setSaving(false) }
  }

  if (!isOperationalCompletionEnabled)
    return <><PageIntro title="Usuarios y permisos" description="La administración segura de perfiles estará disponible después de instalar la migración 16." /><section className="panel empty-state"><h3>Activación pendiente</h3><p>La consulta existente se conserva, pero las modificaciones permanecen deshabilitadas para evitar llamadas a funciones aún no desplegadas.</p></section></>

  return (
    <>
      <PageIntro
        title="Usuarios y permisos"
        description="Consulta, filtra y administra perfiles sin exponer privilegios de Auth en el navegador."
        action={
          <Button icon={UserPlus} onClick={() => setRequestOpen(true)}>Solicitar alta</Button>
        }
      />
      <section className="panel">
        {error ? (
          <QueryError message={error} />
        ) : (
          <>
            <div className="panel-head">
              <div>
                <h3>Directorio de perfiles</h3>
                <p>{filtered.length} de {profiles.length} perfiles visibles</p>
              </div>
              <Users size={21} />
            </div>
            <div className="filter-bar">
              <label className="search-box"><Search size={18} /><input aria-label="Buscar usuario" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, ID o departamento..." /></label>
              <label className="inventory-select"><span>Rol</span><select value={role} onChange={(event) => setRole(event.target.value)}><option value="">Todos</option><option value="usuario">Usuario</option><option value="tecnico">Técnico</option><option value="jefe">Jefe</option></select></label>
              <label className="inventory-select"><span>Estado</span><select value={active} onChange={(event) => setActive(event.target.value)}><option value="">Todos</option><option value="true">Activos</option><option value="false">Inactivos</option></select></label>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Rol</th>
                    <th>Departamento</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((profile) => (
                    <tr key={profile.id}>
                      <td>
                        <strong className="order-id">
                          {profile.institutional_id}
                        </strong>
                      </td>
                      <td>{profile.full_name}</td>
                      <td>{profile.role}</td>
                      <td>{profile.department || "—"}</td>
                      <td>
                        <span className={`badge badge-${profile.active ? "success" : "neutral"}`}>{profile.active ? "Activo" : "Inactivo"}</span>
                      </td>
                      <td><button type="button" className="row-action" onClick={() => { setEditing({ ...profile }); setReason(""); setError("") }}>Editar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && <div className="empty-state"><h3>No hay coincidencias</h3><p>Prueba con otros filtros.</p></div>}
          </>
        )}
      </section>
      <section className="panel"><div className="panel-head"><div><h3>Solicitudes de alta</h3><p>La identidad Auth se crea únicamente mediante la función backend protegida.</p></div><UserPlus size={21} /></div><div className="table-wrap"><table><thead><tr><th>ID institucional</th><th>Nombre</th><th>Rol solicitado</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{requests.map((row) => <tr key={row.id}><td>{row.institutional_id}</td><td>{row.full_name}</td><td>{row.role}</td><td>{row.status}</td><td>{row.status === "pendiente" ? <button type="button" className="row-action" onClick={() => { setProvisioning(row); setTemporaryPassword(""); setError("") }}>Crear cuenta Auth</button> : "—"}</td></tr>)}</tbody></table></div>{requests.length === 0 && <div className="empty-state"><h3>Sin solicitudes</h3></div>}</section>
      {requestOpen && <div className="modal-layer"><form className="modal" onSubmit={submitAccessRequest}><div className="modal-head"><div><span className="eyebrow">Alta segura</span><h2>Solicitar nueva cuenta</h2><p>Un servicio administrativo deberá crear posteriormente la identidad Auth.</p></div></div><div className="form-grid"><label className="field"><span>ID institucional</span><input required pattern="(00|01|02)[0-9]{6}" value={request.institutionalId} onChange={(event) => setRequest({ ...request, institutionalId: event.target.value.replace(/\D/g, "").slice(0, 8) })} /></label><label className="field"><span>Rol</span><select value={request.role} onChange={(event) => setRequest({ ...request, role: event.target.value as Profile["role"] })}><option value="usuario">Usuario</option><option value="tecnico">Técnico</option><option value="jefe">Jefe</option></select></label><label className="field span-2"><span>Nombre completo</span><input required value={request.fullName} onChange={(event) => setRequest({ ...request, fullName: event.target.value })} /></label><label className="field span-2"><span>Departamento</span><input value={request.department} onChange={(event) => setRequest({ ...request, department: event.target.value })} /></label></div>{error && <p className="form-error">{error}</p>}<div className="modal-footer"><Button variant="secondary" onClick={() => setRequestOpen(false)}>Cancelar</Button><Button type="submit">{saving ? "Guardando..." : "Registrar solicitud"}</Button></div></form></div>}
      {provisioning && <div className="modal-layer"><form className="modal" onSubmit={submitProvision}><div className="modal-head"><div><span className="eyebrow">Backend protegido</span><h2>Crear cuenta {provisioning.institutional_id}</h2><p>La contraseña temporal se envía directamente a la función y no se almacena en React ni PostgreSQL.</p></div></div><label className="field"><span>Contraseña temporal *</span><input required type="password" minLength={12} autoComplete="new-password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} /><small>12 caracteres como mínimo, con mayúscula, minúscula y número.</small></label>{error && <p className="form-error">{error}</p>}<div className="modal-footer"><Button variant="secondary" onClick={() => { setProvisioning(null); setTemporaryPassword("") }}>Cancelar</Button><Button type="submit">{saving ? "Creando..." : "Crear cuenta"}</Button></div></form></div>}
      {editing && <div className="modal-layer"><div className="modal"><div className="modal-head"><div><span className="eyebrow">Perfil institucional</span><h2>{editing.full_name}</h2><p>{editing.institutional_id}</p></div></div><div className="form-grid"><label className="field span-2"><span>Nombre completo</span><input value={editing.full_name} onChange={(event) => setEditing({ ...editing, full_name: event.target.value })} /></label><label className="field"><span>Departamento</span><input value={editing.department || ""} onChange={(event) => setEditing({ ...editing, department: event.target.value || null })} /></label><label className="field"><span>Rol</span><select value={editing.role} onChange={(event) => setEditing({ ...editing, role: event.target.value as Profile["role"] })}><option value="usuario">Usuario</option><option value="tecnico">Técnico</option><option value="jefe">Jefe</option></select></label><label className="field"><span>Estado</span><select value={String(editing.active)} onChange={(event) => setEditing({ ...editing, active: event.target.value === "true" })}><option value="true">Activo</option><option value="false">Inactivo</option></select></label><label className="field span-2"><span>Motivo del cambio *</span><textarea required value={reason} onChange={(event) => setReason(event.target.value)} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={saveProfile}>{saving ? "Guardando..." : "Guardar cambios"}</Button></div></div></div>}
    </>
  )
}

export function AuditView() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [profileChanges, setProfileChanges] = useState<ProfileChange[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    listAuditLog()
      .then(setEntries)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "No fue posible cargar la trazabilidad.",
        ),
      )
  }, [])

  useEffect(() => {
    if (isOperationalCompletionEnabled) listProfileChangeHistory().then(setProfileChanges).catch(() => undefined)
  }, [])

  return (
    <>
      <PageIntro
        title="Trazabilidad"
        description="Historial de movimientos recientes del sistema."
      />
      <section className="panel">
        {error ? (
          <QueryError message={error} />
        ) : (
          <>
            <div className="panel-head">
              <div>
                <h3>Actividad reciente</h3>
                <p>
                  Registros generados por cambios en usuarios, capacitaciones y
                  cotizaciones.
                </p>
              </div>
              <History size={21} />
            </div>
            <div className="audit-list">
              {entries.map((entry) => (
                <article key={entry.id}>
                  <span className="summary-icon blue">
                    <History size={17} />
                  </span>
                  <div>
                    <strong>
                      {entry.action} · {entry.entity_type}
                    </strong>
                    <small>
                      {new Date(entry.created_at).toLocaleString("es-MX")} ·{" "}
                      {entry.entity_id || "sin identificador"}
                    </small>
                  </div>
                </article>
              ))}
            </div>
            {entries.length === 0 && (
              <div className="empty-state">
                <h3>Sin movimientos registrados</h3>
              </div>
            )}
          </>
        )}
      </section>
      {isOperationalCompletionEnabled && <section className="panel"><div className="panel-head"><div><h3>Cambios de perfiles</h3><p>Roles y activaciones con motivo obligatorio.</p></div><Users size={21} /></div><div className="audit-list">{profileChanges.map((change) => <article key={change.id}><span className="summary-icon blue"><History size={17} /></span><div><strong>{change.previous_role} → {change.new_role} · {change.previous_active ? "activo" : "inactivo"} → {change.new_active ? "activo" : "inactivo"}</strong><small>{new Date(change.changed_at).toLocaleString("es-MX")} · {change.reason}</small></div></article>)}</div>{profileChanges.length === 0 && <div className="empty-state"><h3>Sin cambios de perfiles</h3></div>}</section>}
    </>
  )
}

function QueryError({ message }: { message: string }) {
  return (
    <div className="empty-state" role="alert">
      <AlertTriangle size={30} />
      <h3>No fue posible cargar la información</h3>
      <p>{message}</p>
    </div>
  )
}
