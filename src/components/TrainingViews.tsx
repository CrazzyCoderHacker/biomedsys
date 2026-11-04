import { useEffect, useState } from "react"

import { CalendarDays, CheckCircle2, GraduationCap, Plus } from "lucide-react"

import { Button, PageIntro } from "./ui"

import { createTraining, listTrainings, type Training } from "../lib/supabase"

export function TrainingCalendar() {
  const [trainings, setTrainings] = useState<Training[]>([])

  const [showForm, setShowForm] = useState(false)

  const [error, setError] = useState("")

  useEffect(() => {
    listTrainings()
      .then(setTrainings)
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "No fue posible cargar capacitaciones.",
        ),
      )
  }, [])

  return (
    <>
      <PageIntro
        title="Calendario de mantenimiento"
        description="Programa mantenimientos y capacitaciones para el personal clínico."
        action={
          <Button icon={Plus} onClick={() => setShowForm(true)}>
            Programar capacitación
          </Button>
        }
      />
      {showForm && (
        <TrainingForm
          onCreated={(training) => {
            setTrainings((current) => [training, ...current])
            setShowForm(false)
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
      {error && <p className="form-error">{error}</p>}
      <section className="panel training-calendar">
        <div className="panel-head">
          <div>
            <h3>Capacitaciones programadas</h3>
            <p>
              Equipo nuevo, personal nuevo, necesidades detectadas y protocolos.
            </p>
          </div>
          <GraduationCap size={22} />
        </div>
        {trainings.length === 0 ? (
          <div className="empty-state">
            <CalendarDays size={34} />
            <h3>No hay capacitaciones registradas</h3>
            <p>Programa la primera sesión usando el botón superior.</p>
          </div>
        ) : (
          <div className="training-list">
            {trainings.map((training) => (
              <article key={training.id}>
                <span className="maintenance-code">
                  <GraduationCap size={18} />
                </span>
                <div>
                  <strong>{training.title}</strong>
                  <small>
                    {training.training_number} ·{" "}
                    {new Date(training.scheduled_at).toLocaleString("es-MX")} ·{" "}
                    {training.location || "Por definir"}
                  </small>
                  <span>
                    {training.purposeLabel} · Recurrencia {training.recurrence}
                  </span>
                </div>
                <CheckCircle2 size={18} />
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

export function TrainingForm({
  onCreated,
  onCancel,
}: {
  onCreated: (training: Training) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState("")

  const [purpose, setPurpose] = useState("equipo_nuevo")

  const [recurrence, setRecurrence] = useState("unica")

  const [scheduledAt, setScheduledAt] = useState("")

  const [location, setLocation] = useState("")

  const [description, setDescription] = useState("")

  const [error, setError] = useState("")

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      onCreated(
        await createTraining({
          title,
          purpose,
          recurrence,
          scheduledAt,
          location,
          description,
        }),
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible guardar la capacitación.",
      )
    }
  }

  return (
    <form className="panel training-form" onSubmit={submit}>
      <div className="panel-head">
        <h3>Nueva capacitación</h3>
      </div>
      <div className="form-grid">
        <label className="field span-2">
          <span>Título *</span>
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ej. Uso seguro del nuevo monitor"
          />
        </label>
        <label className="field">
          <span>Motivo *</span>
          <select
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
          >
            <option value="equipo_nuevo">Equipo nuevo</option>
            <option value="personal_nuevo">Personal nuevo</option>
            <option value="necesidad_detectada">Necesidad detectada</option>
            <option value="protocolo">Protocolo</option>
          </select>
        </label>
        <label className="field">
          <span>Periodicidad *</span>
          <select
            value={recurrence}
            onChange={(event) => setRecurrence(event.target.value)}
          >
            <option value="unica">Única</option>
            <option value="semanal">Semanal</option>
            <option value="mensual">Mensual</option>
            <option value="semestral">Semestral</option>
            <option value="anual">Anual</option>
          </select>
        </label>
        <label className="field">
          <span>Fecha y hora *</span>
          <input
            required
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Ubicación</span>
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Aula o servicio"
          />
        </label>
        <label className="field span-2">
          <span>Descripción</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-footer">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">Guardar capacitación</Button>
      </div>
    </form>
  )
}

export function NoticesView() {
  const [trainings, setTrainings] = useState<Training[]>([])

  useEffect(() => {
    listTrainings()
      .then(setTrainings)
      .catch(() => setTrainings([]))
  }, [])

  return (
    <>
      <PageIntro
        eyebrow="Portal clínico"
        title="Avisos"
        description="Capacitaciones próximas comunicadas por Ingeniería Biomédica."
      />
      <section className="panel">
        <div className="notice-list">
          {trainings.map((training) => (
            <article key={training.id}>
              <span className="summary-icon blue">
                <GraduationCap size={21} />
              </span>
              <div>
                <strong>{training.title}</strong>
                <p>
                  {new Date(training.scheduled_at).toLocaleString("es-MX")} ·{" "}
                  {training.location || "Ubicación por confirmar"}
                </p>
                <small>
                  {training.description ||
                    "Consulta los detalles con Ingeniería Biomédica."}
                </small>
              </div>
              <span className="badge badge-blue">Próxima</span>
            </article>
          ))}
        </div>
        {trainings.length === 0 && (
          <div className="empty-state">
            <h3>No hay avisos por ahora</h3>
            <p>Las próximas capacitaciones aparecerán aquí.</p>
          </div>
        )}
      </section>
    </>
  )
}
