param(
  [Parameter(Mandatory = $true)]
  [string]$DatabaseHost,

  [Parameter(Mandatory = $true)]
  [string]$PgPassFile,

  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory,

  [int]$Port = 5432,
  [string]$DatabaseName = "postgres",
  [string]$DatabaseUser = "postgres",
  [string]$PgBin = "C:\Program Files\PostgreSQL\17\bin"
)

$ErrorActionPreference = "Stop"

$pgDump = Join-Path $PgBin "pg_dump.exe"
$pgRestore = Join-Path $PgBin "pg_restore.exe"

foreach ($tool in @($pgDump, $pgRestore)) {
  if (-not (Test-Path -LiteralPath $tool -PathType Leaf)) {
    throw "No se encontró la herramienta requerida: $tool"
  }
}

$resolvedPassFile = (Resolve-Path -LiteralPath $PgPassFile).Path
if (-not (Test-Path -LiteralPath $resolvedPassFile -PathType Leaf)) {
  throw "No se encontró el archivo PGPASS indicado."
}

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$prefix = Join-Path $resolvedOutput "biomedgest-pre-inventory-$timestamp"
$customDump = "$prefix.dump"
$schemaDump = "$prefix-schema.sql"
$contentsFile = "$prefix-contents.txt"
$hashFile = "$prefix-sha256.txt"

$previousPgPassFile = $env:PGPASSFILE
$env:PGPASSFILE = $resolvedPassFile

try {
  & $pgDump `
    --host=$DatabaseHost `
    --port=$Port `
    --username=$DatabaseUser `
    --dbname=$DatabaseName `
    --format=custom `
    --no-owner `
    --no-acl `
    --file=$customDump
  if ($LASTEXITCODE -ne 0) { throw "Falló pg_dump en formato custom." }

  & $pgDump `
    --host=$DatabaseHost `
    --port=$Port `
    --username=$DatabaseUser `
    --dbname=$DatabaseName `
    --schema-only `
    --no-owner `
    --no-acl `
    --file=$schemaDump
  if ($LASTEXITCODE -ne 0) { throw "Falló pg_dump del esquema." }

  & $pgRestore --list $customDump | Set-Content -LiteralPath $contentsFile -Encoding utf8
  if ($LASTEXITCODE -ne 0) { throw "pg_restore no pudo leer el respaldo generado." }

  $hashes = Get-FileHash -Algorithm SHA256 -LiteralPath $customDump, $schemaDump, $contentsFile
  $hashes | ForEach-Object { "{0}  {1}" -f $_.Hash.ToLowerInvariant(), $_.Path } |
    Set-Content -LiteralPath $hashFile -Encoding ascii

  [pscustomobject]@{
    Backup = $customDump
    Schema = $schemaDump
    Contents = $contentsFile
    Checksums = $hashFile
    VerifiedReadable = $true
  }
}
finally {
  $env:PGPASSFILE = $previousPgPassFile
}

