export function corsHeaders(request: Request) {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map((value) => value.trim()).filter(Boolean)
  const origin = request.headers.get("origin") || ""
  const allowedOrigin = configured.includes(origin) ? origin : configured[0] || ""
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  }
}

export function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) })
}

export function requiredEnvironment() {
  const url = Deno.env.get("SUPABASE_URL")
  const anon = Deno.env.get("SUPABASE_ANON_KEY")
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !anon || !service) throw new Error("Configuración segura incompleta")
  return { url, anon, service }
}
