import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  MonitorCog,
  PackageOpen,
  RefreshCw,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Button, PageIntro } from "./ui";
import {
  getEquipmentInventoryBundle,
  getInventoryCapabilities,
  isSupabaseConfigured,
  listEquipmentInventory,
  type EquipmentInventoryBundle,
  type EquipmentInventoryDetail,
  type InventoryFilters,
  type RiskLevel,
  type Role,
} from "../lib/supabase";

const PAGE_SIZE = 20;

const statusLabels: Record<EquipmentInventoryDetail["status"], string> = {
  operativo: "Operativo",
  en_reparacion: "En reparación",
  fuera_de_servicio: "Fuera de servicio",
  baja: "Baja",
  desconocido: "Sin confirmar",
};

const riskLabels: Record<RiskLevel, string> = {
  bajo: "Bajo",
  medio: "Medio",
  alto: "Alto",
};

function statusTone(status: EquipmentInventoryDetail["status"]) {
  if (status === "operativo") return "success";
  if (status === "en_reparacion" || status === "desconocido") return "warning";
  return "danger";
}

function riskTone(risk: RiskLevel | null) {
  if (risk === "bajo") return "success";
  if (risk === "medio") return "warning";
  if (risk === "alto") return "danger";
  return "neutral";
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function PendingConfiguration() {
  return (
    <section className="panel empty-state inventory-message" role="status">
      <ShieldCheck size={38} />
      <h3>Conexión con Supabase pendiente</h3>
      <p>
        El inventario está preparado para datos reales, pero todavía faltan
        <code> VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> en <code>.env.local</code>.
      </p>
    </section>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <section className="panel empty-state inventory-message" aria-busy="true" aria-live="polite">
      <RefreshCw className="spin" size={34} />
      <h3>{message}</h3>
      <p>La información se consulta respetando los permisos de tu sesión.</p>
    </section>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="panel empty-state inventory-message" role="alert">
      <AlertTriangle size={38} />
      <h3>No fue posible consultar el inventario</h3>
      <p>{message}</p>
      <Button variant="secondary" icon={RefreshCw} onClick={onRetry}>Reintentar</Button>
    </section>
  );
}

export type InventoryApi = {
  list: typeof listEquipmentInventory;
  getBundle: typeof getEquipmentInventoryBundle;
};

const defaultInventoryApi: InventoryApi = {
  list: listEquipmentInventory,
  getBundle: getEquipmentInventoryBundle,
};

export function Inventory({
  role,
  onSelectEquipment,
  api = defaultInventoryApi,
  configured = isSupabaseConfigured,
}: {
  role: Role;
  onSelectEquipment: (equipmentId: string) => void;
  api?: InventoryApi;
  configured?: boolean;
}) {
  const capabilities = getInventoryCapabilities(role);
  const [searchTerm, setSearchTerm] = useState("");
  const [hospitalArea, setHospitalArea] = useState("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel | "">("");
  const [equipment, setEquipment] = useState<EquipmentInventoryDetail[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      const filters: InventoryFilters = {
        searchTerm,
        hospitalArea,
        riskLevel: capabilities.canViewRisk ? riskLevel : "",
      };
      api.list(role, filters)
        .then((items) => {
          if (!active) return;
          setEquipment(items);
          setAreas((current) => Array.from(new Set([
            ...current,
            ...items.map((item) => item.hospital_area).filter((area): area is string => Boolean(area)),
          ])).sort((left, right) => left.localeCompare(right, "es")));
          setPage(1);
        })
        .catch((loadError: unknown) => {
          if (active) setError(loadError instanceof Error ? loadError.message : "Error de consulta no identificado.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [api, capabilities.canViewRisk, configured, hospitalArea, reloadToken, riskLevel, role, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(equipment.length / PAGE_SIZE));
  const visibleEquipment = useMemo(
    () => equipment.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [equipment, page],
  );

  return (
    <>
      <PageIntro
        title={role === "usuario" ? "Consultar equipo" : "Inventario de activos"}
        description={role === "usuario"
          ? "Consulta disponibilidad, identificación y ubicación sin exponer datos técnicos restringidos."
          : "Consulta los equipos médicos, su riesgo y la información técnica validada."}
      />
      {!configured ? <PendingConfiguration /> : (
        <section className="panel inventory-panel">
          <div className="filter-bar" aria-label="Filtros de inventario">
            <label className="search-box">
              <Search size={17} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Código, equipo, fabricante o modelo"
                aria-label="Buscar equipo"
              />
            </label>
            <label className="inventory-select">
              <span>Área</span>
              <select value={hospitalArea} onChange={(event) => setHospitalArea(event.target.value)}>
                <option value="">Todas las áreas</option>
                {areas.map((area) => <option key={area}>{area}</option>)}
              </select>
            </label>
            {capabilities.canViewRisk && (
              <label className="inventory-select">
                <span>Riesgo</span>
                <select value={riskLevel} onChange={(event) => setRiskLevel(event.target.value as RiskLevel | "")}>
                  <option value="">Todos los niveles</option>
                  <option value="alto">Alto</option>
                  <option value="medio">Medio</option>
                  <option value="bajo">Bajo</option>
                </select>
              </label>
            )}
          </div>

          {loading ? <LoadingState message="Consultando equipos..." /> : error ? (
            <ErrorState message={error} onRetry={() => setReloadToken((value) => value + 1)} />
          ) : equipment.length === 0 ? (
            <div className="empty-state inventory-inline-empty">
              <PackageOpen size={34} />
              <h3>No hay equipos para mostrar</h3>
              <p>Prueba con otros criterios o confirma que la importación ya se ejecutó en Supabase.</p>
            </div>
          ) : (
            <>
              <div className="table-wrap inventory-table">
                <table>
                  <thead>
                    <tr>
                      <th>Código</th><th>Equipo</th><th>Fabricante / modelo</th><th>Área / ubicación</th>
                      {capabilities.canViewRisk && <th>Riesgo</th>}<th>Estado</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEquipment.map((item) => (
                      <tr key={item.id} onClick={() => onSelectEquipment(item.id)}>
                        <td><strong className="order-id">{item.inventory_code}</strong></td>
                        <td><strong>{item.equipment_type}</strong></td>
                        <td><strong>{item.manufacturer}</strong><small>{item.model}</small></td>
                        <td><strong>{item.hospital_area || "Sin área"}</strong><small>{item.location || "Sin ubicación específica"}</small></td>
                        {capabilities.canViewRisk && (
                          <td><Badge tone={riskTone(item.current_risk_category)}>{item.current_risk_category ? riskLabels[item.current_risk_category] : "Sin evaluación"}</Badge></td>
                        )}
                        <td><Badge tone={statusTone(item.status)}>{statusLabels[item.status]}</Badge></td>
                        <td><button className="row-action" aria-label={`Abrir ficha ${item.inventory_code}`}>Ver ficha</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <span>{equipment.length} equipo{equipment.length === 1 ? "" : "s"} encontrado{equipment.length === 1 ? "" : "s"}</span>
                <div>
                  <button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</button>
                  <button className="current">{page} / {totalPages}</button>
                  <button disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Siguiente</button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}

function safeDocumentUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function DetailContent({ bundle, role }: { bundle: EquipmentInventoryBundle; role: Role }) {
  const { equipment, risks, documents, programs, issues, restricted } = bundle;
  const currentRisk = risks[0];
  return (
    <>
      <section className="equipment-head">
        <div className="equipment-icon"><MonitorCog size={28} /></div>
        <div className="equipment-title">
          <div>
            <Badge tone={statusTone(equipment.status)}>{statusLabels[equipment.status]}</Badge>
            <span>{equipment.inventory_code}</span>
            {equipment.requires_review && <Badge tone="warning">Revisión pendiente</Badge>}
          </div>
          <h2>{equipment.equipment_type}</h2>
          <p>{equipment.manufacturer} · {equipment.model} · {equipment.hospital_area || "Área no especificada"}</p>
        </div>
      </section>

      {restricted && (
        <div className="inventory-access-note">
          <ShieldCheck size={20} />
          <div><strong>Ficha clínica limitada</strong><span>Los datos técnicos, riesgos, manuales y rutinas están disponibles únicamente para Ingeniería Clínica.</span></div>
        </div>
      )}

      <div className="equipment-layout inventory-detail-layout">
        <section className="panel detail-main">
          <div className="detail-section">
            <h3>Identificación del equipo</h3>
            <div className="data-grid">
              {[
                ["Fabricante", equipment.manufacturer],
                ["Modelo", equipment.model],
                ["Número de serie", equipment.serial_number || "Restringido o no registrado"],
                ["No. de inventario", equipment.inventory_code],
                ["Tipo de equipo", equipment.equipment_type],
                ["Estado", statusLabels[equipment.status]],
                ["Año de fabricación", equipment.manufacture_year?.toString() || "No registrado"],
                ["Año de adquisición", equipment.acquisition_year?.toString() || "No registrado"],
              ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
            </div>
          </div>
          <div className="detail-section">
            <h3>Ubicación</h3>
            <div className="data-grid">
              <div><span>Área hospitalaria</span><strong>{equipment.hospital_area || "No registrada"}</strong></div>
              <div><span>Ubicación específica</span><strong>{equipment.location || "No registrada"}</strong></div>
              <div><span>Resguardo del equipo</span><strong>{equipment.custodian_location_text || "No registrado"}</strong></div>
            </div>
          </div>

          {!restricted && (
            <>
              <div className="detail-section">
                <h3>Evaluación de riesgo</h3>
                {!currentRisk ? <p className="detail-empty">No existe una evaluación de riesgo visible.</p> : (
                  <div className="risk-summary">
                    <Badge tone={riskTone(currentRisk.category)}>{riskLabels[currentRisk.category]}</Badge>
                    <strong>{currentRisk.total_score} puntos</strong>
                    <span>Función {currentRisk.function_score} · Aplicación clínica {currentRisk.clinical_application_score} · Mantenimiento {currentRisk.maintenance_requirement_score}</span>
                    <small>{currentRisk.methodology_name} · {currentRisk.methodology_version}</small>
                  </div>
                )}
              </div>
              <div className="detail-section">
                <h3>Manuales y documentos</h3>
                {documents.length === 0 ? <p className="detail-empty">No hay documentos vinculados.</p> : (
                  <div className="document-list">
                    {documents.map((document) => {
                      const href = safeDocumentUrl(document.url);
                      return (
                        <article key={document.id}>
                          <FileText size={20} />
                          <div><strong>{document.title || (document.document_type === "manual_usuario" ? "Manual de usuario" : "Manual de servicio")}</strong><span>{document.document_type.replace(/_/g, " ")} · {document.review_status}</span></div>
                          {href ? <a href={href} target="_blank" rel="noreferrer">Abrir <ExternalLink size={14} /></a> : <Badge tone="warning">Enlace por revisar</Badge>}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="detail-section">
                <h3>Rutinas de mantenimiento</h3>
                {programs.length === 0 ? <p className="detail-empty">No hay rutinas vinculadas.</p> : (
                  <div className="program-list">
                    {programs.map((program) => (
                      <article key={program.id}>
                        <div><Wrench size={18} /><strong>{program.name}</strong>{program.requires_review && <Badge tone="warning">Revisión pendiente</Badge>}</div>
                        <p>{program.procedure_text}</p>
                        <span>{program.interval_months ? `Cada ${program.interval_months} meses` : "Periodicidad pendiente de definición"}{program.periodicity_basis ? ` · ${program.periodicity_basis}` : ""}</span>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <aside className="detail-aside">
          <section className="panel inventory-summary-card">
            <h3>Resumen técnico</h3>
            <div><span>Nivel de riesgo</span><strong>{equipment.current_risk_category ? riskLabels[equipment.current_risk_category] : "No visible"}</strong></div>
            <div><span>Puntuación</span><strong>{equipment.current_risk_score ?? "—"}</strong></div>
            <div><span>Documentos</span><strong>{restricted ? "Restringidos" : documents.length}</strong></div>
            <div><span>Rutinas</span><strong>{restricted ? "Restringidas" : programs.length}</strong></div>
          </section>
          {role === "jefe" && (
            <section className="panel inventory-issues-card">
              <h3>Incidencias pendientes</h3>
              {issues.length === 0 ? (
                <div className="issue-clear"><CheckCircle2 size={18} /><span>Sin incidencias pendientes para este equipo.</span></div>
              ) : issues.map((issue) => (
                <article key={issue.id}>
                  <Badge tone={issue.severity === "error" ? "danger" : issue.severity === "advertencia" ? "warning" : "info"}>{issue.severity}</Badge>
                  <strong>{issue.issue_code.replace(/_/g, " ")}</strong>
                  <p>{issue.details}</p>
                  {issue.source_value && <small>Valor original: {issue.source_value}</small>}
                </article>
              ))}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

export function EquipmentDetail({
  equipmentId,
  role,
  onBack,
  api = defaultInventoryApi,
  configured = isSupabaseConfigured,
}: {
  equipmentId: string | null;
  role: Role;
  onBack: () => void;
  api?: InventoryApi;
  configured?: boolean;
}) {
  const [bundle, setBundle] = useState<EquipmentInventoryBundle | null>(null);
  const [loading, setLoading] = useState(Boolean(configured && equipmentId));
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!configured || !equipmentId) return;
    let active = true;
    setLoading(true);
    setError("");
    api.getBundle(equipmentId, role)
      .then((result) => { if (active) setBundle(result); })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Error de consulta no identificado.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, configured, equipmentId, reloadToken, role]);

  return (
    <>
      <button className="back-link" onClick={onBack}><ArrowLeft size={17} /> Volver al inventario</button>
      {!configured ? <PendingConfiguration /> : !equipmentId ? (
        <ErrorState message="No se seleccionó ningún equipo." onRetry={onBack} />
      ) : loading ? <LoadingState message="Cargando ficha del equipo..." /> : error ? (
        <ErrorState message={error} onRetry={() => setReloadToken((value) => value + 1)} />
      ) : bundle ? <DetailContent bundle={bundle} role={role} /> : null}
    </>
  );
}
