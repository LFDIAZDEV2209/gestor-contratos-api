# nexogc - Reescribe los 3 secrets con JSON estructurado via file:// (evita quoting de PS 5.1).# Preserva las passwords ya mostradas al usuario (extrae del valor corrupto con regex tolerante).
$ErrorActionPreference = "Stop"
$region = "us-east-1"
$tmp = "$env:TEMP\nexogc-secrets-fix"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

function Write-Json($path, $json) { [System.IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding $false)) }

# --- DB ---
$raw = aws secretsmanager get-secret-value --region $region --secret-id nexogc/prod/db --query SecretString --output text
$user = [regex]::Match($raw, 'username\s*:\s*([^,}]+)').Groups[1].Value
$pass = [regex]::Match($raw, 'password\s*:\s*([^,}]+)').Groups[1].Value
if (-not $user -or -not $pass) { throw "no se pudo parsear db secret" }
Write-Json "$tmp\db.json" ('{"username":"' + $user + '","password":"' + $pass + '","engine":"postgres","host":"nexogc-db-prod.cudcy848inur.us-east-1.rds.amazonaws.com","port":5432,"dbname":"gestor_contratos","dbInstanceIdentifier":"nexogc-db-prod","sslMode":"require"}')
aws secretsmanager put-secret-value --region $region --secret-id nexogc/prod/db --secret-string "file://$tmp\db.json" --query "VersionId" --output text | Out-Null
Write-Host "Secret DB reescrito (JSON valido)"

# --- Valkey ---
$raw = aws secretsmanager get-secret-value --region $region --secret-id nexogc/prod/valkey --query SecretString --output text
$tok = [regex]::Match($raw, 'auth_token\s*:\s*([^,}]+)').Groups[1].Value
if (-not $tok) { throw "no se pudo parsear valkey secret" }
Write-Json "$tmp\valkey.json" ('{"auth_token":"' + $tok + '"}')
aws secretsmanager put-secret-value --region $region --secret-id nexogc/prod/valkey --secret-string "file://$tmp\valkey.json" --query "VersionId" --output text | Out-Null
Write-Host "Secret Valkey reescrito (JSON valido)"

# --- JWT ---
$raw = aws secretsmanager get-secret-value --region $region --secret-id nexogc/prod/jwt --query SecretString --output text
$jwt = [regex]::Match($raw, 'jwt_secret\s*:\s*([^,}]+)').Groups[1].Value
if (-not $jwt) { throw "no se pudo parsear jwt secret" }
Write-Json "$tmp\jwt.json" ('{"jwt_secret":"' + $jwt + '"}')
aws secretsmanager put-secret-value --region $region --secret-id nexogc/prod/jwt --secret-string "file://$tmp\jwt.json" --query "VersionId" --output text | Out-Null
Write-Host "Secret JWT reescrito (JSON valido)"
