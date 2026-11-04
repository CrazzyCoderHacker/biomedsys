import { useEffect, useMemo, useState } from "react";
import {
  createReport,
  getCurrentProfile,
  isSupabaseConfigured,
  listReports,
  signInWithInstitutionalId,
  supabase,
  type CreateReportInput,
  type Role,
} from "./lib/supabase";
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
  Wifi,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { MaintenanceCalendar, NoticesView } from "./components/TrainingViews";
import { AuditView, QuotationsView, UserPermissionsView } from "./components/AdminViews";
import { EquipmentDetail, Inventory } from "./components/InventoryViews";

type View =
  | "dashboard"
  | "reportes"
  | "inventario"
  | "equipo"
  | "orden"
  | "checklist"
  | "calendario"
  | "avisos"
  | "cotizaciones"
  | "usuarios"
  | "trazabilidad";

const roleMeta = {
  jefe: { label: "Jefe de Ingeniería Clínica", short: "Jefe", initials: "AM" },
  tecnico: { label: "Ingeniero biomédico", short: "Ingeniero", initials: "JR" },
  usuario: { label: "Enfermería / Médico", short: "Clínico", initials: "LM" },
};

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
};

function Button({
  children,
  variant = "primary",
  icon: Icon,
  onClick,
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: React.ElementType;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
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
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  const resolved = tone || statusTone[String(children)] || "neutral";
  return <span className={`badge badge-${resolved}`}>{children}</span>;
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
  );
}

const navigation: Record<
  Role,
  { label: string; view: View; icon: React.ElementType }[]
> = {
  jefe: [
    { label: "Resumen", view: "dashboard", icon: LayoutDashboard },
    { label: "Mesa de ayuda", view: "reportes", icon: Headphones },
    { label: "Inventario", view: "inventario", icon: MonitorCog },
    { label: "Mantenimiento", view: "calendario", icon: CalendarDays },
    { label: "Documentos", view: "orden", icon: FileText },
  ],
  tecnico: [
    { label: "Mi jornada", view: "dashboard", icon: LayoutDashboard },
    { label: "Mis órdenes", view: "orden", icon: ClipboardList },
    { label: "Calendario", view: "calendario", icon: CalendarDays },
    { label: "Inventario", view: "inventario", icon: MonitorCog },
  ],
  usuario: [
    { label: "Inicio", view: "dashboard", icon: LayoutDashboard },
    { label: "Mis reportes", view: "reportes", icon: ClipboardList },
    { label: "Solicitud de equipo", view: "inventario", icon: Search },
    { label: "Avisos", view: "avisos", icon: Bell },
  ],
};

function Login({ onLogin }: { onLogin: (role: Role) => void }) {
  const [id, setId] = useState("00123456");
  const [password, setPassword] = useState("biomedgest");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const profile = await signInWithInstitutionalId(id, password);
      onLogin(profile.role);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "No fue posible iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-story-inner">
          <Brand />
          <div className="story-copy">
            <Badge tone="blue">Plataforma hospitalaria segura</Badge>
            <h1>Equipos disponibles.<br />Atención sin interrupciones.</h1>
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
          <div className="mobile-brand"><Brand /></div>
          <div className="eyebrow">Acceso institucional</div>
          <h2>Te damos la bienvenida</h2>
          <p className="muted">Ingresa tu ID institucional de 8 dígitos y contraseña.</p>
          {!isSupabaseConfigured && <p className="form-error" role="alert">Falta configurar Supabase. Copia `.env.example` a `.env.local` y agrega las credenciales públicas del proyecto.</p>}
          <form onSubmit={submit}>
            <label className="field">
              <span>ID Institucional</span>
              <input value={id} onChange={(event) => setId(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" maxLength={8} placeholder="00XXXXXX" />
              <small className="field-help">00 jefe · 01 ingeniero biomédico · 02 enfermería / médico</small>
            </label>
            <label className="field">
              <span>Contraseña</span>
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" className="full-width">{loading ? "Validando..." : "Iniciar sesión"}</Button>
          </form>
          <p className="privacy">Acceso exclusivo para personal autorizado · v2.4</p>
        </div>
      </section>
    </main>
  );
}

function Sidebar({
  role,
  view,
  setView,
  onLogout,
}: {
  role: Role;
  view: View;
  setView: (view: View) => void;
  onLogout: () => void;
}) {
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
            <Icon size={19} /><span>{label}</span>
            {label === "Mesa de ayuda" && <b>8</b>}
          </button>
        ))}
        {role === "jefe" && (
          <>
            <span className="nav-label">ADMINISTRACIÓN</span>
            <button onClick={() => setView("usuarios")}><Users size={19} /><span>Usuarios y permisos</span></button>
            <button onClick={() => setView("trazabilidad")}><History size={19} /><span>Trazabilidad</span></button>
            <button onClick={() => setView("cotizaciones")}><FileText size={19} /><span>Cotizaciones</span></button>
            <button><Settings size={19} /><span>Configuración</span></button>
          </>
        )}
      </nav>
      <div className="compliance-card">
        <ShieldCheck size={19} />
        <div><strong>Cumplimiento al día</strong><span>Última revisión: hoy</span></div>
      </div>
      <button className="profile" onClick={onLogout}>
        <span className="avatar">{roleMeta[role].initials}</span>
        <span><strong>{role === "jefe" ? "Ana Martínez" : role === "tecnico" ? "Jorge Ruiz" : "Laura Méndez"}</strong><small>{roleMeta[role].label}</small></span>
        <LogOut size={17} />
      </button>
    </aside>
  );
}

function AppHeader({ role, title }: { role: Role; title: string }) {
  return (
    <header className="app-header">
      <div className="mobile-logo"><Brand compact /></div>
      <div>
        <span className="breadcrumb">Hospital General San Miguel / Ingeniería Clínica</span>
        <h1>{title}</h1>
      </div>
      <div className="header-actions">
        <div className="connection"><Wifi size={15} /> En línea</div>
        <button className="icon-btn" aria-label="Notificaciones"><Bell size={20} /><i /></button>
        <div className="header-user"><span className="avatar">{roleMeta[role].initials}</span><span><strong>{roleMeta[role].short}</strong><small>Turno matutino</small></span><ChevronDown size={16} /></div>
      </div>
    </header>
  );
}

function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2><p>{description}</p></div>
      {action}
    </div>
  );
}

const orders = [
  { id: "OS-2481", equipment: "Ventilador Servo-i", area: "UCI Adultos", issue: "Alarma de presión alta", priority: "Crítica", tech: "Jorge Ruiz", time: "Hace 18 min" },
  { id: "OS-2479", equipment: "Monitor IntelliVue MX450", area: "Urgencias", issue: "Pantalla intermitente", priority: "Alta", tech: "Sin asignar", time: "Hace 42 min" },
  { id: "OS-2476", equipment: "Bomba de infusión Plum 360", area: "Hospitalización 2", issue: "No reconoce cassette", priority: "Alta", tech: "María Soto", time: "Hace 1 h" },
  { id: "OS-2472", equipment: "Electrocardiógrafo MAC 2000", area: "Cardiología", issue: "Ruido en derivación V2", priority: "Ordinaria", tech: "Jorge Ruiz", time: "Hace 3 h" },
];

function KpiCard({ icon: Icon, label, value, note, tone = "blue" }: { icon: React.ElementType; label: string; value: string; note: string; tone?: string }) {
  return (
    <article className="kpi-card">
      <div className={`kpi-icon tone-${tone}`}><Icon size={21} /></div>
      <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
    </article>
  );
}

function ManagerDashboard({ setView }: { setView: (view: View) => void }) {
  return (
    <>
      <PageIntro
        eyebrow="Lunes, 12 de agosto"
        title="Buenos días, Ana"
        description="Este es el estado operativo del equipamiento médico hoy."
        action={<Button icon={Plus} onClick={() => setView("reportes")}>Nuevo reporte</Button>}
      />
      <div className="kpi-grid">
        <KpiCard icon={MonitorCog} label="Total de equipos" value="1,284" note="+18 este mes" />
        <KpiCard icon={CheckCircle2} label="Operativos" value="1,197" note="93.2% disponibilidad" tone="green" />
        <KpiCard icon={Wrench} label="En reparación" value="34" note="8 prioridad alta" tone="amber" />
        <KpiCard icon={AlertTriangle} label="Fuera de servicio" value="12" note="3 equipos críticos" tone="red" />
        <KpiCard icon={CalendarDays} label="Mant. próximos" value="46" note="7 días siguientes" tone="violet" />
        <KpiCard icon={Clock3} label="Reportes pendientes" value="8" note="2 sin asignar" tone="amber" />
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-head"><div><h3>Fallas por servicio</h3><p>Últimos 30 días</p></div><button className="period-btn">30 días <ChevronDown size={15} /></button></div>
          <div className="bar-chart">
            {[
              ["UCI", 82], ["Urgencias", 64], ["Quirófano", 55], ["Hospitalización", 42], ["Imagenología", 28], ["Consulta", 20],
            ].map(([name, value]) => (
              <div className="bar-col" key={name}><span>{value}</span><div className="bar-track"><i style={{ height: `${value}%` }} /></div><small>{name}</small></div>
            ))}
          </div>
        </section>
        <section className="panel priority-panel">
          <div className="panel-head"><div><h3>Semáforo de atención</h3><p>Reportes activos</p></div><button className="icon-btn"><ChevronRight size={19} /></button></div>
          {[
            ["Crítica", "Riesgo a la atención", "3", "danger"],
            ["Alta", "Afectación de servicio", "8", "warning"],
            ["Ordinaria", "Sin impacto inmediato", "14", "success"],
          ].map(([name, desc, count, tone]) => (
            <div className="priority-row" key={name}><i className={`signal signal-${tone}`} /><div><strong>{name}</strong><span>{desc}</span></div><b>{count}</b></div>
          ))}
          <div className="sla"><Clock3 size={17} /><span><strong>92% dentro de SLA</strong> · 2 casos requieren atención</span></div>
        </section>
      </div>
      <OrdersTable setView={setView} />
    </>
  );
}

function OrdersTable({ setView, compact = false }: { setView: (view: View) => void; compact?: boolean }) {
  return (
    <section className="panel orders-panel">
      <div className="panel-head"><div><h3>{compact ? "Mis órdenes asignadas" : "Órdenes abiertas"}</h3><p>{compact ? "Prioridad y avance de tu jornada" : "Atención técnica en curso"}</p></div><Button variant="ghost" onClick={() => setView("reportes")}>Ver todas <ChevronRight size={16} /></Button></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Orden</th><th>Equipo / ubicación</th><th>Falla reportada</th><th>Prioridad</th><th>Técnico</th><th>Ingreso</th><th /></tr></thead>
          <tbody>
            {orders.slice(0, compact ? 3 : 4).map((order) => (
              <tr key={order.id} onClick={() => setView("orden")}>
                <td><strong className="order-id">{order.id}</strong></td>
                <td><strong>{order.equipment}</strong><small>{order.area}</small></td>
                <td>{order.issue}</td>
                <td><Badge>{order.priority}</Badge></td>
                <td><span className="tech-cell"><i>{order.tech === "Sin asignar" ? "—" : order.tech.split(" ").map(n => n[0]).join("")}</i>{order.tech}</span></td>
                <td>{order.time}</td>
                <td><ChevronRight size={17} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TechnicianDashboard({ setView }: { setView: (view: View) => void }) {
  return (
    <>
      <PageIntro eyebrow="Lunes, 12 de agosto · Turno matutino" title="Hola, Jorge" description="Tienes 5 órdenes activas y 3 mantenimientos programados." action={<Button icon={QrCode} variant="secondary" onClick={() => setView("inventario")}>Escanear equipo</Button>} />
      <div className="tech-summary">
        <div><span className="summary-icon danger"><AlertTriangle size={19} /></span><span><strong>1 crítica</strong><small>Atender ahora</small></span></div>
        <div><span className="summary-icon amber"><Clock3 size={19} /></span><span><strong>2 por vencer</strong><small>En menos de 2 horas</small></span></div>
        <div><span className="summary-icon green"><CheckCircle2 size={19} /></span><span><strong>4 resueltas</strong><small>Durante este turno</small></span></div>
      </div>
      <OrdersTable setView={setView} compact />
      <div className="dashboard-grid tech-bottom">
        <section className="panel">
          <div className="panel-head"><div><h3>Agenda de hoy</h3><p>Mantenimientos preventivos</p></div><Badge tone="blue">3 programados</Badge></div>
          <div className="timeline">
            {[
              ["09:00", "Máquina de anestesia", "Quirófano 2", "Completado"],
              ["11:30", "Desfibrilador R Series", "Carro rojo · Urgencias", "Siguiente"],
              ["14:00", "Incubadora Giraffe", "UCIN", "Pendiente"],
            ].map(([time, name, place, state], i) => (
              <div className={`timeline-item ${i === 0 ? "done" : i === 1 ? "next" : ""}`} key={time}><time>{time}</time><i /><div><strong>{name}</strong><span>{place}</span></div><Badge tone={i === 0 ? "success" : i === 1 ? "blue" : "neutral"}>{state}</Badge></div>
            ))}
          </div>
        </section>
        <section className="panel quick-panel">
          <div className="panel-head"><div><h3>Accesos rápidos</h3><p>Herramientas de campo</p></div></div>
          <button onClick={() => setView("checklist")}><span><Zap size={20} /></span><div><strong>Prueba de seguridad eléctrica</strong><small>Checklist IEC 60601-1</small></div><ChevronRight size={18} /></button>
          <button onClick={() => setView("orden")}><span><ClipboardCheck size={20} /></span><div><strong>Continuar orden OS-2481</strong><small>Diagnóstico guardado</small></div><ChevronRight size={18} /></button>
        </section>
      </div>
    </>
  );
}

const reportSteps = ["Recibido", "Clasificado", "Asignado", "En atención", "Resuelto", "Cerrado"];

function UserDashboard({ setView, openReport }: { setView: (view: View) => void; openReport: () => void }) {
  return (
    <div className="user-page">
      <section className="report-hero">
        <div className="report-hero-icon"><Stethoscope size={28} /></div>
        <div><span className="eyebrow">Mesa de ayuda biomédica</span><h2>¿Un equipo presenta una falla?</h2><p>Repórtala en menos de 2 minutos. Ten a la mano el número de inventario o escanea el código QR.</p></div>
        <Button icon={Plus} onClick={openReport}>Reportar falla</Button>
      </section>
      <div className="user-status-grid">
        <article><span className="summary-icon amber"><Clock3 size={20} /></span><div><strong>2</strong><small>Reportes en atención</small></div></article>
        <article><span className="summary-icon green"><CheckCircle2 size={20} /></span><div><strong>6</strong><small>Resueltos este mes</small></div></article>
        <button onClick={() => setView("inventario")}><span className="summary-icon blue"><Search size={20} /></span><div><strong>Consultar equipo</strong><small>Disponibilidad y ficha básica</small></div><ChevronRight size={18} /></button>
      </div>
      <section className="panel">
        <div className="panel-head"><div><h3>Mis reportes recientes</h3><p>Consulta el avance en tiempo real</p></div><Button variant="ghost" onClick={() => setView("reportes")}>Ver historial</Button></div>
        <div className="report-list">
          <article className="report-item">
            <div className="report-top"><div><span className="report-id">REP-1048</span><h4>Monitor sin lectura de SpO₂</h4><p>Monitor IntelliVue MX450 · Urgencias</p></div><Badge>En atención</Badge></div>
            <div className="stepper">
              {reportSteps.map((step, i) => <div className={i <= 3 ? "complete" : ""} key={step}><i>{i < 3 ? <Check size={12} /> : i + 1}</i><span>{step}</span></div>)}
            </div>
            <div className="report-update"><Wrench size={17} /><span><strong>Jorge Ruiz está revisando el equipo.</strong> Última actualización hace 12 min.</span></div>
          </article>
          <article className="report-item compact-report">
            <div><span className="report-id">REP-1032</span><h4>Bomba de infusión con alarma</h4><p>Hospitalización 2 · Reportado el 9 ago.</p></div><Badge>Resuelto</Badge>
          </article>
        </div>
      </section>
    </div>
  );
}

function ServiceOrder({ setView }: { setView: (view: View) => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <>
      {saved && <div className="toast"><CheckCircle2 size={19} /> Avance guardado correctamente <button onClick={() => setSaved(false)}><X size={16} /></button></div>}
      <div className="order-heading">
        <button className="back-link" onClick={() => setView("dashboard")}><ArrowLeft size={17} /> Volver</button>
        <div><div><Badge tone="danger">Crítica</Badge><span>OS-2481 · Correctivo</span></div><h2>Orden de servicio digital</h2><p>Ventilador Servo-i · UCI Adultos</p></div>
        <div className="save-state"><Check size={15} /> Guardado automático hace 1 min</div>
      </div>
      <div className="order-progress">
        {["Equipo", "Diagnóstico", "Servicio", "Pruebas", "Cierre"].map((s, i) => <div className={i <= 1 ? "active" : ""} key={s}><i>{i === 0 ? <Check size={13} /> : i + 1}</i><span>{s}</span></div>)}
      </div>
      <div className="form-layout">
        <section className="panel form-panel">
          <div className="form-section-title"><span>02</span><div><h3>Diagnóstico técnico</h3><p>Documenta la condición encontrada y las acciones realizadas.</p></div></div>
          <div className="equipment-strip"><MonitorCog size={22} /><div><strong>Ventilador Servo-i</strong><span>Maquet · S/N 28471039 · EQ-000184</span></div><Badge>En reparación</Badge></div>
          <div className="form-grid">
            <label className="field"><span>Tipo de servicio</span><select defaultValue="Correctivo"><option>Correctivo</option><option>Preventivo</option><option>Inspección</option></select></label>
            <label className="field"><span>Fecha y hora de inicio</span><input defaultValue="12/08/2024 · 10:42" /></label>
            <label className="field span-2"><span>Descripción de la falla reportada</span><textarea defaultValue="Durante ventilación controlada se activa alarma de presión alta de forma intermitente. Personal clínico realizó cambio de circuito sin resolver." /></label>
            <label className="field span-2"><span>Diagnóstico técnico <b>Obligatorio</b></span><textarea placeholder="Describe hallazgos, causa raíz y condición del equipo..." defaultValue="Se identifica obstrucción parcial en sensor de flujo espiratorio y desviación en lectura de presión. Se requiere limpieza, calibración y prueba funcional." /></label>
            <label className="field span-2"><span>Acciones realizadas</span><textarea placeholder="Detalla el trabajo realizado..." /></label>
          </div>
          <div className="subsection-head"><div><h4>Refacciones y consumibles</h4><p>Registra piezas instaladas o retiradas.</p></div><Button variant="secondary" icon={Plus}>Agregar refacción</Button></div>
          <div className="empty-inline"><PackageOpen size={23} /><span>No se han agregado refacciones.</span></div>
          <div className="evidence-box"><div><FileCheck2 size={25} /><div><strong>Evidencia fotográfica</strong><span>Arrastra fotografías o toca para seleccionar. JPG, PNG · máx. 10 MB</span></div></div><Button variant="secondary">Seleccionar archivos</Button></div>
          <div className="form-footer"><Button variant="secondary" onClick={() => setSaved(true)}>Guardar borrador</Button><Button onClick={() => setView("checklist")}>Continuar a pruebas <ChevronRight size={17} /></Button></div>
        </section>
        <aside className="order-aside">
          <section className="panel"><h3>Resumen de la orden</h3><div className="order-data"><span>Reportado por<strong>Laura Méndez · Enfermería</strong></span><span>Ingreso<strong>12 ago · 10:24</strong></span><span>SLA objetivo<strong>2 horas</strong></span><span>Tiempo transcurrido<strong className="amber-text">1 h 18 min</strong></span></div></section>
          <section className="panel help-card"><ShieldCheck size={21} /><div><strong>Registro normativo</strong><p>La información formará parte del expediente técnico y la bitácora institucional.</p></div></section>
        </aside>
      </div>
    </>
  );
}

function ElectricalChecklist({ setView }: { setView: (view: View) => void }) {
  const tests = [
    ["Voltaje línea – neutro", "127.2", "V", "110–130 V"],
    ["Voltaje línea – tierra", "126.8", "V", "110–130 V"],
    ["Resistencia de tierra", "0.08", "Ω", "≤ 0.2 Ω"],
    ["Corriente de fuga a tierra", "182", "µA", "≤ 500 µA"],
    ["Corriente de fuga al paciente", "7.4", "µA", "≤ 100 µA"],
  ];
  return (
    <>
      <button className="back-link" onClick={() => setView("orden")}><ArrowLeft size={17} /> Volver a la orden OS-2481</button>
      <PageIntro eyebrow="Paso 4 de 5" title="Pruebas de seguridad eléctrica" description="Checklist basado en IEC 60601-1 · Registra valores medidos y valida resultados." action={<Badge tone="blue">Borrador guardado</Badge>} />
      <div className="check-layout">
        <section className="panel checklist-panel">
          <div className="meter-card"><div className="meter-icon"><Gauge size={25} /></div><div><span>Equipo de medición</span><strong>FLUKE Medical ESA615</strong><small>S/N 4589231 · Calibración vigente hasta 18/02/2025</small></div><Badge tone="success">Vigente</Badge></div>
          <div className="check-head"><div><strong>Prueba / parámetro</strong></div><div>Valor medido</div><div>Límite aceptable</div><div>Resultado</div></div>
          <div className="test-list">
            {tests.map(([name, value, unit, limit]) => <div className="test-row" key={name}><div><span className="test-check"><Check size={14} /></span><strong>{name}</strong></div><label><input defaultValue={value} /><span>{unit}</span></label><span>{limit}</span><Badge tone="success">Aprobado</Badge></div>)}
          </div>
          <div className="visual-checks"><h3>Inspección visual y funcional</h3>{["Cable de alimentación sin daño", "Clavija hospitalaria íntegra", "Etiquetas y datos legibles", "Alarmas audibles y visuales funcionales"].map(item => <label key={item}><input type="checkbox" defaultChecked /><span><Check size={14} /></span>{item}</label>)}</div>
          <label className="field"><span>Observaciones de la prueba</span><textarea placeholder="Agrega notas o condiciones particulares..." /></label>
          <div className="result-banner"><CheckCircle2 size={25} /><div><strong>Resultado general: APROBADO</strong><span>5 de 5 pruebas eléctricas y 4 de 4 inspecciones cumplen.</span></div></div>
          <div className="form-footer"><Button variant="secondary" onClick={() => setView("orden")}>Guardar y salir</Button><Button>Continuar al cierre <ChevronRight size={17} /></Button></div>
        </section>
        <aside className="order-aside">
          <section className="panel"><h3>Equipo bajo prueba</h3><div className="mini-equipment"><MonitorCog size={24} /><div><strong>Ventilador Servo-i</strong><span>EQ-000184 · Clase I, Tipo BF</span></div></div><div className="order-data"><span>Ubicación<strong>UCI Adultos</strong></span><span>Fabricante<strong>Maquet</strong></span><span>Norma aplicable<strong>IEC 60601-1</strong></span></div></section>
          <section className="panel caution-card"><AlertTriangle size={20} /><div><strong>Antes de medir</strong><p>Desconecta accesorios del paciente y verifica la configuración de clase eléctrica.</p></div></section>
        </aside>
      </div>
    </>
  );
}

function CalendarView() {
  const days = ["Lun 12", "Mar 13", "Mié 14", "Jue 15", "Vie 16"];
  const maintenanceTypes = [
    ["MP", "Preventivo", "Revisión programada para conservar el desempeño del equipo.", "46"],
    ["IN", "Inspección", "Verificación visual, funcional y de seguridad.", "18"],
    ["MC", "Correctivo", "Atención de una falla reportada y documentada.", "12"],
  ];
  return (
    <>
      <PageIntro title="Mantenimiento" description="Catálogo e identificadores para preventivo, inspección y correctivo." action={<Button icon={Plus}>Programar mantenimiento</Button>} />
      <section className="maintenance-catalog">
        {maintenanceTypes.map(([prefix, name, description, count]) => (
          <article className="panel maintenance-type" key={prefix}>
            <div className="maintenance-code">{prefix}</div>
            <div><span className="eyebrow">Tipo de mantenimiento</span><h3>{name}</h3><p>{description}</p></div>
            <strong>{count}<small>programados</small></strong>
          </article>
        ))}
      </section>
      <section className="panel maintenance-key">
        <div><div><span className="eyebrow">Identificador de mantenimiento</span><h3>Formato: MT-{new Date().getFullYear()}-TIPO-0000</h3></div><p>Los folios se generan automáticamente por tipo: <strong>MP</strong> preventivo, <strong>IN</strong> inspección y <strong>MC</strong> correctivo.</p></div>
      </section>
      <section className="panel calendar-panel">
        <div className="calendar-toolbar"><Button variant="secondary">Hoy</Button><div><button><ArrowLeft size={17} /></button><strong>12 – 16 agosto 2024</strong><button><ChevronRight size={17} /></button></div><div className="view-toggle"><button>Mes</button><button className="active">Semana</button></div></div>
        <div className="week-grid">{days.map((day, i) => <div key={day} className={i === 0 ? "today" : ""}><strong>{day}</strong>{i === 0 && <><article className="event blue">09:00 · Máquina de anestesia<small>Quirófano 2 · Jorge Ruiz</small></article><article className="event amber">14:00 · Incubadora Giraffe<small>UCIN · Riesgo alto</small></article></>}{i === 1 && <article className="event green">10:30 · Bomba Plum 360<small>Hospitalización 2</small></article>}{i === 3 && <article className="event violet">12:00 · Desfibrilador R Series<small>Urgencias</small></article>}</div>)}</div>
      </section>
    </>
  );
}

function ReportTray({ role, setView, openReport }: { role: Role; setView: (v: View) => void; openReport: () => void }) {
  const [reports, setReports] = useState<Awaited<ReturnType<typeof listReports>>>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    listReports().then(setReports).catch((reportError) => {
      setError(reportError instanceof Error ? reportError.message : "No fue posible cargar los reportes.");
    });
  }, []);
  return (
    <>
      <PageIntro title={role === "usuario" ? "Mis reportes" : "Mesa de ayuda"} description={role === "usuario" ? "Seguimiento de solicitudes y fallas reportadas." : "Clasifica, prioriza y asigna reportes de equipamiento médico."} action={<Button icon={Plus} onClick={openReport}>{role === "usuario" ? "Reportar falla" : "Registrar reporte"}</Button>} />
      <section className="panel orders-panel">
        <div className="filter-bar"><label className="search-box"><Search size={18} /><input placeholder="Buscar folio, equipo o servicio..." /></label><button className="filter-btn">Prioridad <ChevronDown size={15} /></button><button className="filter-btn">Estado <ChevronDown size={15} /></button></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="ticket-list">{reports.map((report) => <article key={report.report_number}><i className={`ticket-signal ${report.priority === "Crítica" ? "red" : report.priority === "Alta" ? "amber" : "green"}`} /><div className="ticket-main"><span>{report.report_number} · {new Date(report.created_at).toLocaleString("es-MX")}</span><strong>{report.description}</strong><small>{report.equipment_identifier} · {report.service}</small></div><Badge>{report.priority}</Badge><Badge>{report.status}</Badge>{role === "jefe" && <Button variant="secondary" onClick={() => setView("orden")}>Ver caso</Button>}<ChevronRight size={18} /></article>)}</div>
      </section>
    </>
  );
}

function ReportModal({ onClose }: { onClose: () => void }) {
  const [sent, setSent] = useState(false);
  const [reportNumber, setReportNumber] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateReportInput>({
    equipmentIdentifier: "",
    eventDate: new Date().toISOString().slice(0, 10),
    eventType: "Falla",
    service: "Urgencias",
    location: "",
    manufacturer: "",
    modelSerial: "",
    description: "",
    patientOutcome: "Sin lesión",
    actionTaken: "",
  });

  function updateField(field: keyof CreateReportInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      setReportNumber(await createReport(form));
      setSent(true);
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "No fue posible guardar el reporte.");
    } finally {
      setSaving(false);
    }
  }

  if (sent) return <div className="modal-layer"><div className="modal success-modal"><div className="success-mark"><Check size={30} /></div><h2>Reporte recibido</h2><p>El folio <strong>{reportNumber}</strong> fue enviado a Ingeniería Clínica. Te notificaremos cada avance.</p><Button onClick={onClose}>Entendido</Button></div></div>;
  return (
    <div className="modal-layer">
      <form className="modal report-modal" onSubmit={submit}>
        <div className="modal-head"><div><span className="eyebrow">Nuevo reporte</span><h2>Reportar falla de equipo</h2><p>Cuéntanos qué sucede. Los campos con * son obligatorios.</p></div><button className="icon-btn" onClick={onClose}><X size={21} /></button></div>
        <div className="form-grid">
          <label className="field span-2"><span>Equipo o número de inventario *</span><div className="input-action"><input required value={form.equipmentIdentifier} onChange={(event) => updateField("equipmentIdentifier", event.target.value)} placeholder="Ej. EQ-000293 o Monitor IntelliVue" /><button type="button"><QrCode size={19} /> Escanear</button></div></label>
          <label className="field"><span>Fecha del evento *</span><input required type="date" value={form.eventDate} onChange={(event) => updateField("eventDate", event.target.value)} /></label>
          <label className="field"><span>Tipo de evento *</span><select value={form.eventType} onChange={(event) => updateField("eventType", event.target.value)}><option>Falla</option><option>Incidente</option><option>Mal funcionamiento</option><option>Lesión asociada</option></select></label>
          <label className="field"><span>Servicio *</span><select required value={form.service} onChange={(event) => updateField("service", event.target.value)}><option>Urgencias</option><option>Hospitalización</option><option>UCI Adultos</option></select></label>
          <label className="field"><span>Ubicación</span><input value={form.location} onChange={(event) => updateField("location", event.target.value)} placeholder="Ej. Cubículo 3" /></label>
          <label className="field"><span>Fabricante</span><input value={form.manufacturer} onChange={(event) => updateField("manufacturer", event.target.value)} placeholder="Fabricante del equipo" /></label>
          <label className="field"><span>Modelo / serie</span><input value={form.modelSerial} onChange={(event) => updateField("modelSerial", event.target.value)} placeholder="Modelo y número de serie" /></label>
          <label className="field span-2"><span>Descripción del evento *</span><textarea required value={form.description} onChange={(event) => updateField("description", event.target.value)} placeholder="Describe qué ocurrió, cuándo comenzó y las condiciones del equipo..." /></label>
          <label className="field"><span>Resultado para el paciente</span><select value={form.patientOutcome} onChange={(event) => updateField("patientOutcome", event.target.value)}><option>Sin lesión</option><option>Lesión temporal</option><option>Lesión grave</option><option>Fallecimiento</option><option>No aplica</option></select></label>
          <label className="field"><span>Acción tomada</span><input value={form.actionTaken} onChange={(event) => updateField("actionTaken", event.target.value)} placeholder="Equipo retirado, atención inmediata..." /></label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="priority-suggest"><AlertTriangle size={20} /><div><strong>La prioridad se calculará automáticamente</strong><span>Consideraremos el riesgo del equipo y el impacto en la atención.</span></div></div>
        <div className="photo-upload"><Plus size={20} /><span><strong>Agregar foto o video</strong><small>Ayuda al técnico a preparar la atención</small></span></div>
        <div className="modal-footer"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit">{saving ? "Guardando..." : "Enviar reporte"}</Button></div>
      </form>
    </div>
  );
}

function BottomNav({ role, view, setView }: { role: Role; view: View; setView: (v: View) => void }) {
  return <nav className="bottom-nav">{navigation[role].slice(0, 4).map(({ label, view: v, icon: Icon }) => <button key={label} className={view === v ? "active" : ""} onClick={() => setView(v)}><Icon size={20} /><span>{label.split(" ")[0]}</span></button>)}</nav>;
}

export default function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  useEffect(() => {
    getCurrentProfile()
      .then((profile) => setRole(profile?.role ?? null))
      .catch(() => setRole(null))
      .finally(() => setLoadingSession(false));
  }, []);
  const title = useMemo(() => ({
    dashboard: role === "jefe" ? "Panel de control" : role === "tecnico" ? "Mi jornada" : "Inicio",
    reportes: role === "usuario" ? "Mis reportes" : "Mesa de ayuda",
    inventario: "Inventario",
    equipo: "Ficha de equipo",
    orden: "Orden de servicio",
    checklist: "Checklist eléctrico",
    calendario: "Mantenimiento",
    avisos: "Avisos",
    cotizaciones: "Cotizaciones",
    usuarios: "Usuarios y permisos",
    trazabilidad: "Trazabilidad",
  }[view]), [role, view]);

  if (loadingSession) return <main className="session-loading">Cargando sesión...</main>;
  if (!role) return <Login onLogin={(newRole) => { setRole(newRole); setView("dashboard"); }} />;

  return (
    <div className="app-shell">
      <Sidebar role={role} view={view} setView={setView} onLogout={() => { void supabase?.auth.signOut(); setRole(null); }} />
      <div className="app-main">
        <AppHeader role={role} title={title} />
        <main className="content">
          {view === "dashboard" && role === "jefe" && <ManagerDashboard setView={setView} />}
          {view === "dashboard" && role === "tecnico" && <TechnicianDashboard setView={setView} />}
          {view === "dashboard" && role === "usuario" && <UserDashboard setView={setView} openReport={() => setReportOpen(true)} />}
          {view === "inventario" && <Inventory role={role} onSelectEquipment={(equipmentId) => { setSelectedEquipmentId(equipmentId); setView("equipo"); }} />}
          {view === "equipo" && <EquipmentDetail equipmentId={selectedEquipmentId} role={role} onBack={() => setView("inventario")} />}
          {view === "orden" && <ServiceOrder setView={setView} />}
          {view === "checklist" && <ElectricalChecklist setView={setView} />}
          {view === "calendario" && <MaintenanceCalendar role={role} />}
          {view === "avisos" && <NoticesView />}
          {view === "cotizaciones" && <QuotationsView />}
          {view === "usuarios" && <UserPermissionsView />}
          {view === "trazabilidad" && <AuditView />}
          {view === "reportes" && <ReportTray role={role} setView={setView} openReport={() => setReportOpen(true)} />}
        </main>
      </div>
      <BottomNav role={role} view={view} setView={setView} />
      {reportOpen && <ReportModal onClose={() => setReportOpen(false)} />}
    </div>
  );
}
