import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(path) {
  return Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

const localEnv = readEnvFile(".env.local");
const url = localEnv.VITE_SUPABASE_URL;
const key = localEnv.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local.");
}

const cases = [
  {
    expectedRole: "jefe",
    institutionalId: process.env.BIOMEDGEST_JEFE_ID,
    password: process.env.BIOMEDGEST_JEFE_PASSWORD,
  },
  {
    expectedRole: "tecnico",
    institutionalId: process.env.BIOMEDGEST_TECNICO_ID,
    password: process.env.BIOMEDGEST_TECNICO_PASSWORD,
  },
  {
    expectedRole: "usuario",
    institutionalId: process.env.BIOMEDGEST_USUARIO_ID,
    password: process.env.BIOMEDGEST_USUARIO_PASSWORD,
  },
];

const missing = cases.flatMap(({ expectedRole, institutionalId, password }) => {
  const names = [];
  if (!institutionalId) names.push(`BIOMEDGEST_${expectedRole.toUpperCase()}_ID`);
  if (!password) names.push(`BIOMEDGEST_${expectedRole.toUpperCase()}_PASSWORD`);
  return names;
});

if (missing.length) {
  throw new Error(`Define localmente las variables requeridas: ${missing.join(", ")}`);
}

const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

const results = [];

for (const testCase of cases) {
  const email = `${testCase.institutionalId}@biomedgest.local`;
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password: testCase.password,
  });

  if (authError) {
    results.push({ expectedRole: testCase.expectedRole, login: false, reason: authError.message });
    continue;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", authData.user.id)
    .single();

  results.push({
    expectedRole: testCase.expectedRole,
    login: true,
    profileReadable: !profileError,
    actualRole: profile?.role ?? null,
    active: profile?.active ?? null,
    roleMatches: profile?.role === testCase.expectedRole,
  });

  await supabase.auth.signOut({ scope: "local" });
}

console.log(JSON.stringify(results, null, 2));
process.exitCode = results.every((result) => result.login && result.profileReadable && result.roleMatches)
  ? 0
  : 1;

