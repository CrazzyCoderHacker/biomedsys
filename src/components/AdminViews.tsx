import { useEffect, useState } from "react"

import { AlertTriangle, History, UserPlus, Users } from "lucide-react"

import { Button, PageIntro } from "./ui"

import {
  createQuote,
  listAuditLog,
  listProfiles,
  listQuotes,
  type AuditEntry,
  type Profile,
  type Quote,
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
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSaving(true)
    try {
      onCreated(
        await createQuote({
          supplier,
          equipmentDescription,
          amount: Number(amount),
          notes,
        }),
      )
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
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
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

export function UserPermissionsView() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [error, setError] = useState("")

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

  return (
    <>
      <PageIntro
        title="Usuarios y permisos"
        description="Usuarios activos que pueden iniciar sesión en el sistema."
        action={
          <span className="btn btn-secondary" aria-disabled="true">
            Alta de usuario pendiente
          </span>
        }
      />
      <section className="panel">
        {error ? (
          <QueryError message={error} />
        ) : (
          <>
            <div className="panel-head">
              <div>
                <h3>Usuarios activos</h3>
                <p>{profiles.length} perfiles visibles</p>
              </div>
              <Users size={21} />
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
                  {profiles.map((profile) => (
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
                        <span className="badge badge-success">Activo</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  )
}

export function AuditView() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
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
