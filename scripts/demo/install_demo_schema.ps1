[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z0-9]{20}$')]
    [string]$DemoProjectRef,

    [string]$PostgresBin = 'C:\Program Files\PostgreSQL\17\bin'
)

$ErrorActionPreference = 'Stop'
$officialProjectRef = 'yvqccoavcwfzcxrfvsjs'
if ($DemoProjectRef -eq $officialProjectRef) {
    throw 'Instalación cancelada: el proyecto indicado es el Supabase oficial.'
}

$databaseUrl = $env:BIOMEDGEST_DEMO_DATABASE_URL
if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    throw 'Define BIOMEDGEST_DEMO_DATABASE_URL en la sesión actual. No la guardes en el repositorio.'
}
if ($databaseUrl -match [regex]::Escape($officialProjectRef)) {
    throw 'Instalación cancelada: la conexión apunta al Supabase oficial.'
}
if ($databaseUrl -notmatch [regex]::Escape($DemoProjectRef)) {
    throw 'La conexión no contiene el identificador del proyecto Demo confirmado.'
}

$psql = Join-Path $PostgresBin 'psql.exe'
if (-not (Test-Path -LiteralPath $psql -PathType Leaf)) {
    throw "No se encontró psql en $psql"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$migrationFiles = @(
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
    'supabase\05_security.sql',
    'supabase\12_inventory_security.sql',
    'supabase\13_inventory_administration.sql',
    'supabase\14_security_hardening.sql',
    'supabase\15_corrective_workflow.sql',
    'supabase\16_operational_completion.sql',
    'supabase\17_training_quotes_completion.sql',
    'supabase\18_final_integration.sql'
)

foreach ($relativePath in $migrationFiles) {
    $path = Join-Path $repoRoot $relativePath
    Write-Host "Aplicando $relativePath"
    & $psql -X --set ON_ERROR_STOP=1 --dbname $databaseUrl --file $path
    if ($LASTEXITCODE -ne 0) {
        throw "La instalación se detuvo en $relativePath"
    }
}

Write-Host 'Esquema Demo instalado. Cree ahora las tres cuentas Auth y ejecute seed_synthetic_demo.sql.'
