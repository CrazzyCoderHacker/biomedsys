import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders, json, requiredEnvironment } from "../_shared/http.ts"

type ProvisionBody = {
  action: "provision"
  institutionalId: string
  fullName: string
  role: "usuario" | "tecnico" | "jefe"
  department?: string
  temporaryPassword: string
  accessRequestId?: number
}
type AuthStatusBody = { action: "set-auth-status"; profileId: string; active: boolean }

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
    if (!profile?.active || profile.role !== "jefe") return json(request, { error: "Operación reservada para el rol jefe" }, 403)

    const body = await request.json() as ProvisionBody | AuthStatusBody
    if (body.action === "set-auth-status") {
      if (!/^[0-9a-f-]{36}$/i.test(body.profileId)) return json(request, { error: "Perfil inválido" }, 400)
      if (body.profileId === userResult.user.id && !body.active) return json(request, { error: "No puedes bloquear tu propia cuenta" }, 400)
      const { data: target } = await serviceClient.from("profiles").select("id, active").eq("id", body.profileId).single()
      if (!target || target.active !== body.active) return json(request, { error: "El estado del perfil debe actualizarse primero mediante la RPC auditada" }, 409)
      const { error: authUpdateError } = await serviceClient.auth.admin.updateUserById(body.profileId, { ban_duration: body.active ? "none" : "876000h" })
      if (authUpdateError) return json(request, { error: authUpdateError.message }, 400)
      return json(request, { id: body.profileId, active: body.active })
    }
    if (body.action !== "provision") return json(request, { error: "Acción no soportada" }, 400)
    const prefixes = { jefe: "00", tecnico: "01", usuario: "02" }
    if (!/^(00|01|02)\d{6}$/.test(body.institutionalId) || !body.institutionalId.startsWith(prefixes[body.role]))
      return json(request, { error: "ID institucional incompatible con el rol" }, 400)
    if (body.fullName.trim().length < 3) return json(request, { error: "Nombre inválido" }, 400)
    if (body.temporaryPassword.length < 12 || !/[A-Z]/.test(body.temporaryPassword) || !/[a-z]/.test(body.temporaryPassword) || !/\d/.test(body.temporaryPassword))
      return json(request, { error: "La contraseña temporal debe tener al menos 12 caracteres, mayúscula, minúscula y número" }, 400)

    const { data: duplicate } = await serviceClient.from("profiles").select("id").eq("institutional_id", body.institutionalId).maybeSingle()
    if (duplicate) return json(request, { error: "El ID institucional ya existe" }, 409)
    const email = `${body.institutionalId}@biomedgest.local`
    const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
      email, password: body.temporaryPassword, email_confirm: true,
      user_metadata: { institutional_id: body.institutionalId },
    })
    if (createError || !created.user) return json(request, { error: createError?.message || "No fue posible crear Auth" }, 400)
    const { error: profileError } = await serviceClient.from("profiles").insert({
      id: created.user.id, institutional_id: body.institutionalId, full_name: body.fullName.trim(),
      role: body.role, department: body.department?.trim() || null, active: true, must_change_password: true,
    })
    if (profileError) {
      await serviceClient.auth.admin.deleteUser(created.user.id)
      return json(request, { error: "No fue posible asociar el perfil; la cuenta Auth fue revertida" }, 409)
    }
    if (body.accessRequestId) await serviceClient.from("user_access_requests").update({ status: "creado" }).eq("id", body.accessRequestId).eq("status", "pendiente")
    return json(request, { id: created.user.id, institutionalId: body.institutionalId, mustChangePassword: true }, 201)
  } catch (error) {
    return json(request, { error: error instanceof Error ? error.message : "Error no identificado" }, 500)
  }
})
