import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders, json, requiredEnvironment } from "../_shared/http.ts"

const bucket = "biomedgest-private"

async function listPaths(client: SupabaseClient, prefix = ""): Promise<string[]> {
  const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000 })
  if (error) throw error
  const paths: string[] = []
  for (const item of data || []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name
    if (item.id) paths.push(path)
    else paths.push(...await listPaths(client, path))
  }
  return paths
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) })
  if (request.method !== "POST") return json(request, { error: "Método no permitido" }, 405)
  try {
    const { url, anon, service } = requiredEnvironment()
    const authorization = request.headers.get("authorization") || ""
    if (!authorization.startsWith("Bearer ")) return json(request, { error: "Sesión requerida" }, 401)
    const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
    const serviceClient = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: userResult, error: userError } = await caller.auth.getUser()
    if (userError || !userResult.user) return json(request, { error: "Sesión inválida" }, 401)
    const { data: profile } = await caller.from("profiles").select("role, active").eq("id", userResult.user.id).single()
    if (!profile?.active) return json(request, { error: "Perfil inactivo" }, 403)
    const body = await request.json() as { action: "delete" | "integrity"; attachmentId?: string }

    if (body.action === "delete") {
      if (!body.attachmentId) return json(request, { error: "attachmentId es obligatorio" }, 400)
      const { data: attachment, error: attachmentError } = await caller.from("file_attachments")
        .select("id, storage_path, uploaded_by, deleted_at").eq("id", body.attachmentId).single()
      if (attachmentError || !attachment || attachment.deleted_at) return json(request, { error: "Archivo no encontrado o no autorizado" }, 404)
      if (attachment.uploaded_by !== userResult.user.id && profile.role !== "jefe") return json(request, { error: "Permiso denegado" }, 403)
      const { error: deactivateError } = await caller.rpc("deactivate_attachment", { target_attachment_id: attachment.id })
      if (deactivateError) return json(request, { error: deactivateError.message }, 403)
      const { error: removeError } = await serviceClient.storage.from(bucket).remove([attachment.storage_path])
      if (removeError) {
        await serviceClient.from("file_attachments").update({ deleted_at: null, deleted_by: null }).eq("id", attachment.id)
        return json(request, { error: "No se eliminó el objeto; el metadato fue restaurado" }, 502)
      }
      return json(request, { deleted: true, id: attachment.id })
    }

    if (body.action === "integrity") {
      if (profile.role !== "jefe") return json(request, { error: "Operación reservada para el rol jefe" }, 403)
      const [{ data: metadata, error: metadataError }, paths] = await Promise.all([
        serviceClient.from("file_attachments").select("id, storage_path, deleted_at"), listPaths(serviceClient),
      ])
      if (metadataError) throw metadataError
      const activePaths = new Set((metadata || []).filter((row) => !row.deleted_at).map((row) => row.storage_path))
      const objectPaths = new Set(paths)
      return json(request, {
        missingObjects: (metadata || []).filter((row) => !row.deleted_at && !objectPaths.has(row.storage_path)),
        orphanObjects: paths.filter((path) => !activePaths.has(path)),
      })
    }
    return json(request, { error: "Acción no soportada" }, 400)
  } catch (error) {
    return json(request, { error: error instanceof Error ? error.message : "Error no identificado" }, 500)
  }
})
