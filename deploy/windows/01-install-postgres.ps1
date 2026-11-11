# 01 - Install PostgreSQL 17 as a Windows service, bind it to 127.0.0.1 only,
#      and create the `classmanager` role + database. Re-runnable.
# Run in an elevated PowerShell:  powershell -ExecutionPolicy Bypass -File .\01-install-postgres.ps1

. "$PSScriptRoot\common.ps1"
Assert-Admin
Ensure-RootLayout

$psql = "$PgBin\psql.exe"

# -- 1. Install (only if the service does not exist yet) ---------------
if (-not (Get-Service $PgService -ErrorAction SilentlyContinue)) {
    Write-Step "Installing PostgreSQL $PgMajor via winget"
    $superPass = Get-OrCreateSecret $PgSuperPassFile 32
    $installerArgs = @(
        '--mode', 'unattended', '--unattendedmodeui', 'none',
        '--superpassword', $superPass,
        '--serverport', "$PgPort", '--servicename', $PgService,
        # pgAdmin = 10k+ small files (very slow with Defender); psql is enough for this server
        '--disable-components', 'pgAdmin,stackbuilder'
    )
    # EDB's CDN sometimes aborts big downloads (403 mid-way). If the installer was pre-downloaded
    # (curl -C - ... see docs/DEPLOY.md) into $PgInstaller, verify its hash and run it directly.
    if (Test-Path $PgInstaller) {
        $hash = (Get-FileHash $PgInstaller -Algorithm SHA256).Hash
        if ($hash -ne $PgInstallerSha256) { throw "Hash mismatch for $PgInstaller - delete it and download again." }
        Write-Step "Running pre-downloaded installer $PgInstaller"
        $p = Start-Process -FilePath $PgInstaller -ArgumentList $installerArgs -Wait -PassThru
        if ($p.ExitCode -ne 0) { throw "PostgreSQL installer exited with code $($p.ExitCode)." }
    } else {
        & winget install --id "PostgreSQL.PostgreSQL.$PgMajor" -e --source winget --silent `
            --accept-package-agreements --accept-source-agreements --override ($installerArgs -join ' ')
    }
    if (-not (Get-Service $PgService -ErrorAction SilentlyContinue)) { throw "Service $PgService not found after install." }
} else {
    Write-Step "PostgreSQL service $PgService already installed"
    if (-not (Test-Path $PgSuperPassFile)) {
        throw "Postgres is installed but $PgSuperPassFile is missing. Put the postgres superuser password there and re-run."
    }
}
$superPass = (Get-Content $PgSuperPassFile -Raw).Trim()

# -- 2. Listen on loopback only ----------------------------------------
Write-Step 'Restricting listen_addresses to 127.0.0.1'
$conf = "$PgData\postgresql.conf"
$lines = Get-Content $conf
$new = $lines -replace "^\s*#?\s*listen_addresses\s*=.*$", "listen_addresses = '127.0.0.1'"
if (-not ($new -match "^listen_addresses = '127.0.0.1'")) { $new += "listen_addresses = '127.0.0.1'" }
if (($new -join "`n") -ne ($lines -join "`n")) {
    [IO.File]::WriteAllLines($conf, [string[]]$new, (New-Object Text.UTF8Encoding $false))
    Restart-Service $PgService
}
# pg_hba.conf from the EDB installer only allows 127.0.0.1/32 and ::1/128 (scram-sha-256). Warn if not.
$wide = Select-String "$PgData\pg_hba.conf" -Pattern '^\s*host\S*\s+\S+\s+\S+\s+(all|samenet|0\.0\.0\.0/0|::/0)\s' -ErrorAction SilentlyContinue
if ($wide) { Write-Warning "pg_hba.conf has wide 'host' rules - review: $($wide.Line -join '; ')" }

Set-Service $PgService -StartupType Automatic
if ((Get-Service $PgService).Status -ne 'Running') { Start-Service $PgService }

# -- 3. Role + database (password kept in sync with the secret file) ---
Write-Step "Ensuring role/database '$DbName'"
$dbPass = Get-OrCreateSecret $DbPassFile 32
$env:PGPASSWORD = $superPass
try {
    # SQL goes through stdin so the password never appears on a command line
    @"
DO `$`$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$DbUser') THEN
    CREATE ROLE $DbUser LOGIN;
  END IF;
END `$`$;
ALTER ROLE $DbUser WITH LOGIN PASSWORD '$dbPass';
"@ | & $psql -h 127.0.0.1 -p $PgPort -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f -
    if ($LASTEXITCODE -ne 0) { throw 'Creating role failed.' }

    $exists = & $psql -h 127.0.0.1 -p $PgPort -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DbName'"
    if ($exists -ne '1') {
        & $psql -h 127.0.0.1 -p $PgPort -U postgres -d postgres -v ON_ERROR_STOP=1 -q `
            -c "CREATE DATABASE $DbName OWNER $DbUser ENCODING 'UTF8' TEMPLATE template0"
        if ($LASTEXITCODE -ne 0) { throw 'Creating database failed.' }
    }
} finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }

# -- 4. pgpass file for backups / admin psql (classmanager role) -------
Set-Content $PgPassConf "127.0.0.1:${PgPort}:${DbName}:${DbUser}:$dbPass" -NoNewline -Encoding ascii
Set-RestrictedAcl $SecretsDir

Write-Step "Done. Service: $PgService  |  DB: $DbName  |  secrets in $SecretsDir"
