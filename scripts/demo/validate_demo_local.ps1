[CmdletBinding()]
param(
    [string]$PostgresBin = 'C:\Program Files\PostgreSQL\17\bin',
    [int]$Port = 55434,
    [switch]$KeepData
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$runRoot = Join-Path $tempBase ("biomedgest-demo-validation-{0}" -f [guid]::NewGuid().ToString('N'))
$dataDir = Join-Path $runRoot 'pgdata'
$serverLog = Join-Path $runRoot 'postgres.log'
$database = 'biomedgest_demo_validation'
$serverStarted = $false

$initDb = Join-Path $PostgresBin 'initdb.exe'
$pgCtl = Join-Path $PostgresBin 'pg_ctl.exe'
$createdb = Join-Path $PostgresBin 'createdb.exe'
$psql = Join-Path $PostgresBin 'psql.exe'

foreach ($tool in @($initDb, $pgCtl, $createdb, $psql)) {
    if (-not (Test-Path -LiteralPath $tool -PathType Leaf)) {
        throw "No se encontró la herramienta requerida: $tool"
    }
}

function Invoke-PsqlFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    Write-Host ("Validando {0}" -f (Split-Path -Leaf $Path))
    & $psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $Port -U postgres -d $database -f $Path
    if ($LASTEXITCODE -ne 0) { throw "Falló el script SQL: $Path" }
}

$migrationFiles = @(
    'supabase\01_users.sql',
    'supabase\02_inventory.sql',
    'supabase\03_maintenance.sql',
    'supabase\04_reports.sql',
    'supabase\07_training.sql',
    'supabase\08_quotes.sql',
    'supabase\09_audit.sql',
    'supabase\10_access_requests.sql',
    'supabase\11_inventory_relations.sql',
    'scripts\inventory\local_grants.sql',
    'supabase\05_security.sql',
    'supabase\12_inventory_security.sql',
    'supabase\13_inventory_administration.sql',
    'supabase\14_security_hardening.sql',
    'supabase\15_corrective_workflow.sql',
    'supabase\16_operational_completion.sql',
    'supabase\17_training_quotes_completion.sql',
    'supabase\18_final_integration.sql'
)

try {
    New-Item -ItemType Directory -Path $runRoot | Out-Null
    & $initDb -D $dataDir -U postgres -A trust --encoding UTF8 --no-locale | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo inicializar PostgreSQL.' }

    & $pgCtl -D $dataDir -l $serverLog -o "-p $Port -h 127.0.0.1" -w start
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar PostgreSQL.' }
    $serverStarted = $true

    & $createdb -h 127.0.0.1 -p $Port -U postgres $database
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la base desechable.' }

    Invoke-PsqlFile (Join-Path $repoRoot 'scripts\inventory\local_supabase_bootstrap.sql')
    Invoke-PsqlFile (Join-Path $repoRoot 'supabase\00_core.sql')

    & $psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $Port -U postgres -d $database -c @'
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000001', '00123456@biomedgest.local', now()),
  ('00000000-0000-4000-8000-000000000002', '01123456@biomedgest.local', now()),
  ('00000000-0000-4000-8000-000000000003', '02123456@biomedgest.local', now());
'@
    if ($LASTEXITCODE -ne 0) { throw 'No se crearon las identidades sintéticas locales.' }

    foreach ($relativePath in $migrationFiles) {
        Invoke-PsqlFile (Join-Path $repoRoot $relativePath)
    }
    Invoke-PsqlFile (Join-Path $repoRoot 'scripts\demo\seed_synthetic_demo.sql')
    Invoke-PsqlFile (Join-Path $repoRoot 'scripts\demo\seed_synthetic_demo.sql')
    Invoke-PsqlFile (Join-Path $repoRoot 'scripts\demo\verify_demo_postflight.sql')

    & $psql -X -qAt -h 127.0.0.1 -p $Port -U postgres -d $database -c @'
select json_build_object(
  'profiles', (select count(*) from public.profiles),
  'equipment', (select count(*) from public.equipment_assets),
  'risks', (select count(*) from public.risk_assessments),
  'programs', (select count(*) from public.maintenance_programs),
  'program_links', (select count(*) from public.equipment_maintenance_programs)
);
'@
    if ($LASTEXITCODE -ne 0) { throw 'Falló el resumen final.' }
    Write-Host 'VALIDACIÓN DEMO LOCAL COMPLETADA: esquema desde cero, semilla repetible y postflight aprobados.'
}
finally {
    if ($serverStarted) {
        & $pgCtl -D $dataDir -m fast -w stop | Out-Null
    }
    if (-not $KeepData -and (Test-Path -LiteralPath $runRoot)) {
        $resolvedRunRoot = [IO.Path]::GetFullPath($runRoot)
        $safePrefix = Join-Path $tempBase 'biomedgest-demo-validation-'
        if (-not $resolvedRunRoot.StartsWith($safePrefix, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Se evitó borrar una ruta inesperada: $resolvedRunRoot"
        }
        Remove-Item -LiteralPath $resolvedRunRoot -Recurse -Force
    } elseif ($KeepData) {
        Write-Host "Entorno conservado en: $runRoot"
    }
}
