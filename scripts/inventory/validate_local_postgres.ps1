[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SourceXlsx,

    [string]$PostgresBin = 'C:\Program Files\PostgreSQL\17\bin',
    [string]$PythonExecutable = 'py',
    [int]$Port = 55433,
    [switch]$KeepData
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$projectPython = Join-Path $repoRoot '.venv-inventory\Scripts\python.exe'
if ($PythonExecutable -eq 'py' -and (Test-Path -LiteralPath $projectPython -PathType Leaf)) {
    $PythonExecutable = $projectPython
}
$sourcePath = (Resolve-Path -LiteralPath $SourceXlsx).Path
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$runRoot = Join-Path $tempBase ("biomedgest-inventory-validation-{0}" -f [guid]::NewGuid().ToString('N'))
$dataDir = Join-Path $runRoot 'pgdata'
$generatedDir = Join-Path $runRoot 'generated'
$serverLog = Join-Path $runRoot 'postgres.log'
$database = 'biomedgest_inventory_validation'
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
    & $psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $Port -U postgres -d $database -f $Path
    if ($LASTEXITCODE -ne 0) { throw "Falló el script SQL: $Path" }
}

function Invoke-PythonImporter {
    if ([IO.Path]::GetFileNameWithoutExtension($PythonExecutable) -eq 'py') {
        & $PythonExecutable -3 (Join-Path $repoRoot 'scripts\inventory\extract_inventory.py') $sourcePath --output-dir $generatedDir
    } else {
        & $PythonExecutable (Join-Path $repoRoot 'scripts\inventory\extract_inventory.py') $sourcePath --output-dir $generatedDir
    }
    if ($LASTEXITCODE -ne 0) { throw 'Falló la generación del paquete de importación.' }
}

$baseMigrationFiles = @(
    'scripts\inventory\local_supabase_bootstrap.sql',
    'supabase\00_core.sql',
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
    'supabase\14_security_hardening.sql'
)

$pendingMigrationStages = @(
    @{
        Preflight = 'scripts\inventory\preflight_15_readonly.sql'
        Migration = 'supabase\15_corrective_workflow.sql'
        Postflight = 'scripts\inventory\verify_corrective_workflow_postflight.sql'
    },
    @{
        Preflight = 'scripts\inventory\preflight_16_readonly.sql'
        Migration = 'supabase\16_operational_completion.sql'
        Postflight = 'scripts\inventory\verify_operational_completion_postflight.sql'
    },
    @{
        Preflight = 'scripts\inventory\preflight_17_readonly.sql'
        Migration = 'supabase\17_training_quotes_completion.sql'
        Postflight = 'scripts\inventory\verify_business_completion_postflight.sql'
    },
    @{
        Preflight = 'scripts\inventory\preflight_18_readonly.sql'
        Migration = 'supabase\18_final_integration.sql'
        Postflight = 'scripts\inventory\verify_final_integration_postflight.sql'
    }
)

$migrationFiles = @($baseMigrationFiles) + @($pendingMigrationStages | ForEach-Object { $_.Migration })

try {
    New-Item -ItemType Directory -Path $runRoot, $generatedDir | Out-Null
    & $initDb -D $dataDir -U postgres -A trust --encoding UTF8 --no-locale
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo inicializar PostgreSQL.' }

    & $pgCtl -D $dataDir -l $serverLog -o "-p $Port -h 127.0.0.1" -w start
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar PostgreSQL.' }
    $serverStarted = $true

    & $createdb -h 127.0.0.1 -p $Port -U postgres $database
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la base desechable.' }

    Invoke-PythonImporter

    foreach ($relativePath in $baseMigrationFiles) {
        Invoke-PsqlFile (Join-Path $repoRoot $relativePath)
    }
    Invoke-PsqlFile (Join-Path $generatedDir 'inventory_import.sql')

    foreach ($stage in $pendingMigrationStages) {
        Invoke-PsqlFile (Join-Path $repoRoot $stage.Preflight)
        Invoke-PsqlFile (Join-Path $repoRoot $stage.Migration)
        Invoke-PsqlFile (Join-Path $repoRoot $stage.Postflight)
    }

    Invoke-PsqlFile (Join-Path $repoRoot 'scripts\inventory\validate_inventory_database.sql')
    Invoke-PsqlFile (Join-Path $repoRoot 'scripts\inventory\validate_inventory_administration.sql')
    Invoke-PsqlFile (Join-Path $repoRoot 'scripts\inventory\validate_security_hardening.sql')
    Invoke-PsqlFile (Join-Path $repoRoot 'scripts\inventory\verify_security_hardening_postflight.sql')
    Invoke-PsqlFile (Join-Path $repoRoot 'scripts\inventory\validate_corrective_workflow.sql')
    Invoke-PsqlFile (Join-Path $repoRoot 'scripts\inventory\verify_corrective_workflow_postflight.sql')
    Invoke-PsqlFile (Join-Path $repoRoot 'scripts\inventory\validate_operational_completion.sql')
    Invoke-PsqlFile (Join-Path $repoRoot 'scripts\inventory\verify_operational_completion_postflight.sql')
    Invoke-PsqlFile (Join-Path $repoRoot 'scripts\inventory\validate_training_quotes_completion.sql')
    Invoke-PsqlFile (Join-Path $repoRoot 'scripts\inventory\verify_business_completion_postflight.sql')
    Invoke-PsqlFile (Join-Path $repoRoot 'scripts\inventory\validate_final_integration.sql')
    Invoke-PsqlFile (Join-Path $repoRoot 'scripts\inventory\verify_final_integration_postflight.sql')

    # Segunda ejecución: demuestra que migraciones e importación son repetibles.
    foreach ($relativePath in $migrationFiles) {
        Invoke-PsqlFile (Join-Path $repoRoot $relativePath)
    }
    Invoke-PsqlFile (Join-Path $generatedDir 'inventory_import.sql')

    & $psql -X -qAt -h 127.0.0.1 -p $Port -U postgres -d $database -c @'
select json_build_object(
  'assets', (select count(*) from public.equipment_assets),
  'risks', (select count(*) from public.risk_assessments),
  'programs', (select count(*) from public.maintenance_programs),
  'asset_program_links', (select count(*) from public.equipment_maintenance_programs),
  'documents', (select count(*) from public.equipment_documents),
  'document_links', (select count(*) from public.equipment_document_links),
  'review_issues', (select count(*) from public.inventory_import_issues),
  'rls_tables', (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relrowsecurity),
  'policies', (select count(*) from pg_policies where schemaname = 'public'),
  'base_tables', (select count(*) from pg_tables where schemaname = 'public'),
  'views', (select count(*) from pg_views where schemaname = 'public'),
  'functions', (select count(*) from pg_proc where pronamespace = 'public'::regnamespace),
  'triggers', (
    select count(*) from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relnamespace = 'public'::regnamespace and not t.tgisinternal
  )
);
'@
    if ($LASTEXITCODE -ne 0) { throw 'Falló el resumen final.' }
    Write-Host 'VALIDACIÓN LOCAL COMPLETADA: pruebas funcionales aprobadas y segunda migración/importación sin duplicaciones.'
}
finally {
    if ($serverStarted) {
        & $pgCtl -D $dataDir -m fast -w stop | Out-Null
    }

    if (-not $KeepData -and (Test-Path -LiteralPath $runRoot)) {
        $resolvedRunRoot = [IO.Path]::GetFullPath($runRoot)
        $safePrefix = Join-Path $tempBase 'biomedgest-inventory-validation-'
        if (-not $resolvedRunRoot.StartsWith($safePrefix, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Se evitó borrar una ruta inesperada: $resolvedRunRoot"
        }
        Remove-Item -LiteralPath $resolvedRunRoot -Recurse -Force
    } elseif ($KeepData) {
        Write-Host "Entorno conservado en: $runRoot"
    }
}
