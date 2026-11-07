import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const OFFICIAL_PROJECT_REF = "yvqccoavcwfzcxrfvsjs";
const root = path.resolve(import.meta.dirname, "../..");

function loadPublicDemoEnv() {
  const envPath = path.join(root, ".env.demo");
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      }),
  );
}

const publicEnv = loadPublicDemoEnv();
const url = publicEnv.VITE_DEMO_SUPABASE_URL || process.env.VITE_DEMO_SUPABASE_URL;
const anonKey = publicEnv.VITE_DEMO_SUPABASE_ANON_KEY || process.env.VITE_DEMO_SUPABASE_ANON_KEY;
const demoProjectRef = process.env.BIOMEDGEST_DEMO_PROJECT_REF;

if (!url || !anonKey || !demoProjectRef) {
  throw new Error(
    "Faltan .env.demo y/o BIOMEDGEST_DEMO_PROJECT_REF. Consulta docs/supabase-demo.md.",
  );
}
if (demoProjectRef === OFFICIAL_PROJECT_REF || url.includes(OFFICIAL_PROJECT_REF)) {
  throw new Error("Prueba cancelada: la configuración apunta al proyecto oficial.");
}
if (!url.includes(demoProjectRef)) {
  throw new Error("La URL pública no coincide con BIOMEDGEST_DEMO_PROJECT_REF.");
}

const accounts = {
  user: {
    email: "02123456@biomedgest.local",
    password: process.env.BIOMEDGEST_DEMO_USER_PASSWORD,
    role: "usuario",
  },
  technician: {
    email: "01123456@biomedgest.local",
    password: process.env.BIOMEDGEST_DEMO_TECH_PASSWORD,
    role: "tecnico",
  },
  manager: {
    email: "00123456@biomedgest.local",
    password: process.env.BIOMEDGEST_DEMO_MANAGER_PASSWORD,
    role: "jefe",
  },
};

for (const [name, account] of Object.entries(accounts)) {
  if (!account.password) {
    throw new Error(`Falta la contraseña temporal en BIOMEDGEST_DEMO_${name === "user" ? "USER" : name === "technician" ? "TECH" : "MANAGER"}_PASSWORD.`);
  }
}

function client() {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

const clients = {
  user: client(),
  technician: client(),
  manager: client(),
};

function ensureNoError(result, context) {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data;
}

function expectDenied(result, context) {
  if (!result.error) throw new Error(`${context}: la operación debió ser rechazada.`);
}

async function signInAndVerify(name) {
  const account = accounts[name];
  const auth = ensureNoError(
    await clients[name].auth.signInWithPassword({
      email: account.email,
      password: account.password,
    }),
    `Auth ${name}`,
  );
  const profile = ensureNoError(
    await clients[name]
      .from("profiles")
      .select("id, institutional_id, role, active")
      .eq("id", auth.user.id)
      .single(),
    `Perfil ${name}`,
  );
  if (!profile.active || profile.role !== account.role) {
    throw new Error(`Perfil ${name}: rol o estado inesperado.`);
  }
  return profile;
}

const summary = {
  projectRef: demoProjectRef,
  auth: {},
  rlsNegative: [],
  report: null,
  order: null,
  auditRows: 0,
  storage: null,
  notifications: 0,
  timeline: 0,
};

try {
  const [userProfile, technicianProfile, managerProfile] = await Promise.all([
    signInAndVerify("user"),
    signInAndVerify("technician"),
    signInAndVerify("manager"),
  ]);
  summary.auth = {
    usuario: userProfile.institutional_id,
    tecnico: technicianProfile.institutional_id,
    jefe: managerProfile.institutional_id,
  };

  const directory = ensureNoError(
    await clients.user.rpc("search_equipment_directory", { search_term: "EQ-900001" }),
    "Directorio visible para usuario",
  );
  if (directory.length !== 1) throw new Error("El usuario no recuperó el equipo Demo.");

  const inventory = ensureNoError(
    await clients.manager.rpc("search_equipment_inventory", {
      search_term: "EQ-900001",
      area_filter: null,
      risk_filter: null,
    }),
    "Inventario visible para jefe",
  );
  if (inventory.length !== 1) throw new Error("El jefe no recuperó el equipo Demo.");
  const equipment = inventory[0];

  const runId = new Date().toISOString();
  const report = ensureNoError(
    await clients.user
      .from("reports")
      .insert({
        equipment_id: equipment.id,
        equipment_identifier: equipment.inventory_code,
        event_date: runId.slice(0, 10),
        event_type: "Falla sintética de demostración",
        service: "Urgencias Demo",
        location: "Cubículo Demo 1",
        manufacturer: equipment.manufacturer,
        model_serial: `${equipment.model} / DEMO-SN-001`,
        description: `Reporte E2E sintético ${runId}`,
        patient_outcome: "Sin paciente involucrado; escenario sintético.",
        action_taken: "Equipo Demo retirado del escenario.",
      })
      .select("id, report_number, reporter_id, status, equipment_id")
      .single(),
    "Creación del reporte",
  );
  summary.report = report.report_number;

  expectDenied(
    await clients.user.rpc("create_corrective_order_from_report", {
      target_report_id: report.id,
      target_assigned_to: technicianProfile.id,
      target_priority: "alta",
      target_scheduled_at: new Date(Date.now() - 60_000).toISOString(),
    }),
    "Usuario creando orden",
  );
  summary.rlsNegative.push("usuario no crea orden");

  expectDenied(
    await clients.user
      .from("reports")
      .update({ status: "Cerrado" })
      .eq("id", report.id),
    "Usuario actualizando reporte directamente",
  );
  summary.rlsNegative.push("usuario no actualiza reporte directamente");

  const scheduledAt = new Date(Date.now() - 60_000).toISOString();
  const order = ensureNoError(
    await clients.manager.rpc("create_corrective_order_from_report", {
      target_report_id: report.id,
      target_assigned_to: technicianProfile.id,
      target_priority: "alta",
      target_scheduled_at: scheduledAt,
    }),
    "Creación de orden correctiva",
  );
  summary.order = order.maintenance_number;

  expectDenied(
    await clients.manager.rpc("create_corrective_order_from_report", {
      target_report_id: report.id,
      target_assigned_to: technicianProfile.id,
      target_priority: "alta",
      target_scheduled_at: scheduledAt,
    }),
    "Duplicación de orden",
  );
  summary.rlsNegative.push("orden correctiva duplicada rechazada");

  expectDenied(
    await clients.user.rpc("update_assigned_maintenance_status", {
      target_maintenance_id: order.id,
      new_status: "en_proceso",
    }),
    "Usuario iniciando orden",
  );
  summary.rlsNegative.push("usuario no inicia orden");

  ensureNoError(
    await clients.technician.rpc("update_assigned_maintenance_status", {
      target_maintenance_id: order.id,
      new_status: "en_proceso",
    }),
    "Técnico iniciando orden",
  );

  const startedAt = new Date(Date.now() - 30_000).toISOString();
  const completedAt = new Date().toISOString();
  expectDenied(
    await clients.user.rpc("save_corrective_intervention", {
      target_maintenance_id: order.id,
      new_started_at: startedAt,
      new_completed_at: completedAt,
      new_diagnosis: "No autorizado",
      new_work_performed: "No autorizado",
      new_test_results: "No autorizado",
      new_equipment_condition: "operativo",
      new_technical_notes: null,
    }),
    "Usuario registrando intervención",
  );
  summary.rlsNegative.push("usuario no registra intervención");

  ensureNoError(
    await clients.technician.rpc("save_corrective_intervention", {
      target_maintenance_id: order.id,
      new_started_at: startedAt,
      new_completed_at: completedAt,
      new_diagnosis: "Evento sintético reproducible.",
      new_work_performed: "Inspección funcional sintética sin equipo clínico real.",
      new_test_results: "Resultado Demo satisfactorio.",
      new_equipment_condition: "operativo",
      new_technical_notes: "Datos exclusivos del entorno Demo.",
    }),
    "Registro de intervención",
  );

  ensureNoError(
    await clients.manager.rpc("validate_corrective_closure", {
      target_maintenance_id: order.id,
      validation_notes: "Cierre validado en la prueba E2E Demo.",
    }),
    "Validación del cierre",
  );

  const persistedOrder = ensureNoError(
    await clients.manager
      .from("maintenances")
      .select("id, status, source_report_id, assigned_to, validated_by, validated_at")
      .eq("id", order.id)
      .single(),
    "Recuperación PostgreSQL de la orden",
  );
  const persistedReport = ensureNoError(
    await clients.user
      .from("reports")
      .select("id, status, maintenance_id")
      .eq("id", report.id)
      .single(),
    "Recuperación PostgreSQL del reporte",
  );
  const persistedRecord = ensureNoError(
    await clients.technician
      .from("maintenance_records")
      .select("maintenance_id, performed_by, started_at, completed_at, equipment_condition")
      .eq("maintenance_id", order.id)
      .single(),
    "Recuperación PostgreSQL de la intervención",
  );

  if (
    persistedOrder.status !== "completado" ||
    persistedOrder.source_report_id !== report.id ||
    persistedOrder.assigned_to !== technicianProfile.id ||
    persistedOrder.validated_by !== managerProfile.id ||
    !persistedOrder.validated_at ||
    persistedReport.status !== "Cerrado" ||
    persistedReport.maintenance_id !== order.id ||
    persistedRecord.performed_by !== technicianProfile.id ||
    persistedRecord.equipment_condition !== "operativo"
  ) {
    throw new Error("La recuperación final no conserva las relaciones o estados esperados.");
  }

  const audit = ensureNoError(
    await clients.manager
      .from("audit_log")
      .select("id, actor_id, action, entity_type, entity_id")
      .in("entity_type", ["reports", "maintenances", "maintenance_records"])
      .order("id", { ascending: false })
      .limit(30),
    "Lectura de auditoría",
  );
  const relatedAudit = audit.filter(
    (row) =>
      (row.entity_type === "reports" && row.entity_id === String(report.id)) ||
      (row.entity_type === "maintenances" && row.entity_id === String(order.id)) ||
      (row.entity_type === "maintenance_records" && row.actor_id === technicianProfile.id),
  );
  if (relatedAudit.length < 5) {
    throw new Error("La auditoría del flujo Demo está incompleta.");
  }
  summary.auditRows = relatedAudit.length;

  const timeline = ensureNoError(
    await clients.manager.rpc("get_equipment_activity", { target_equipment_id: equipment.id }),
    "Historial por equipo",
  );
  if (!timeline.some((row) => row.reference === report.report_number) || !timeline.some((row) => row.reference === order.maintenance_number)) {
    throw new Error("El historial del equipo no contiene el reporte y la orden E2E.");
  }
  summary.timeline = timeline.length;
  expectDenied(
    await clients.user.rpc("get_equipment_activity", { target_equipment_id: equipment.id }),
    "Usuario consultando historial técnico del equipo",
  );
  summary.rlsNegative.push("usuario no consulta historial técnico");

  ensureNoError(await clients.technician.rpc("refresh_my_preventive_notifications"), "Actualización de notificaciones");
  const notifications = ensureNoError(
    await clients.technician.from("notifications").select("id, read_at").order("created_at", { ascending: false }).limit(50),
    "Notificaciones del técnico",
  );
  summary.notifications = notifications.length;
  if (notifications[0]) ensureNoError(await clients.technician.rpc("mark_notification_read", { target_notification_id: notifications[0].id, mark_read: true }), "Lectura de notificación");

  const storagePath = `${userProfile.id}/report/${report.id}/${crypto.randomUUID()}-evidence.txt`;
  ensureNoError(
    await clients.user.storage.from("biomedgest-private").upload(storagePath, new Blob(["BioMedGest E2E synthetic evidence"], { type: "text/plain" })),
    "Carga Storage",
  );
  const attachment = ensureNoError(
    await clients.user.from("file_attachments").insert({ storage_path: storagePath, original_name: "evidence.txt", mime_type: "text/plain", size_bytes: 34, report_id: report.id, description: "Evidencia sintética E2E" }).select("id, bucket, storage_path").single(),
    "Metadatos Storage",
  );
  const signed = ensureNoError(await clients.user.storage.from(attachment.bucket).createSignedUrl(attachment.storage_path, 60), "URL firmada autorizada");
  const downloaded = await fetch(signed.signedUrl);
  if (!downloaded.ok || !(await downloaded.text()).includes("synthetic evidence")) throw new Error("La descarga firmada no devolvió la evidencia esperada.");
  expectDenied(await clients.technician.storage.from(attachment.bucket).createSignedUrl(attachment.storage_path, 60), "Técnico ajeno descargando evidencia");
  summary.rlsNegative.push("técnico ajeno no descarga evidencia");
  ensureNoError(await clients.user.functions.invoke("storage-admin", { body: { action: "delete", attachmentId: attachment.id } }), "Eliminación compensada Storage");
  const remainingAttachment = ensureNoError(await clients.user.from("file_attachments").select("id").eq("id", attachment.id), "Verificación de desactivación");
  if (remainingAttachment.length !== 0) throw new Error("El archivo desactivado continúa visible.");
  summary.storage = { upload: true, signedDownload: true, unauthorizedDenied: true, deletion: true };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} finally {
  await Promise.all(Object.values(clients).map((item) => item.auth.signOut({ scope: "local" })));
}
