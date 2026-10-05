# nexogc - Secrets Manager (credenciales random, mostradas UNA VEZ) + bucket S3 privado.
$ErrorActionPreference = "Continue"
$region = "us-east-1"

function Rand($len) { aws secretsmanager get-random-password --region $region --password-length $len --exclude-punctuation --require-each-included-type --output text --query RandomPassword }

# --- Secret DB (host se actualiza tras crear RDS) ---
$dbSecret = "nexogc/prod/db"
$exists = aws secretsmanager describe-secret --region $region --secret-id $dbSecret --query "ARN" --output text 2>$null
if ($exists -and $exists -ne "None") { Write-Host "Secret DB ya existe: $exists" }
else {
  $dbPass = Rand 40
  $dbUser = "nexogc_admin"
  $val = "{""username"":""$dbUser"",""password"":""$dbPass"",""engine"":""postgres"",""port"":5432,""dbname"":""gestor_contratos""}"
  aws secretsmanager create-secret --region $region --name $dbSecret --description "nexogc RDS PostgreSQL master (prod)" --secret-string $val --output text | Out-Null
  Write-Host "== SECRET DB (mostrado UNA VEZ) =="
  Write-Host "DB_USER: $dbUser"
  Write-Host "DB_PASSWORD: $dbPass"
  $val = $null
}

# --- Secret Valkey (auth token para ElastiCache) ---
$vSecret = "nexogc/prod/valkey"
$exists = aws secretsmanager describe-secret --region $region --secret-id $vSecret --query "ARN" --output text 2>$null
if ($exists -and $exists -ne "None") { Write-Host "Secret Valkey ya existe: $exists" }
else {
  # Auth token ElastiCache: min 16 chars, permitidos especificos (sin @ " / espacios)
  $vToken = Rand 40
  $val = "{""auth_token"":""$vToken""}"
  aws secretsmanager create-secret --region $region --name $vSecret --description "nexogc ElastiCache Valkey auth token (prod)" --secret-string $val --output text | Out-Null
  Write-Host "== SECRET VALKEY (mostrado UNA VEZ) =="
  Write-Host "VALKEY_AUTH_TOKEN: $vToken"
  $val = $null
}

# --- Secret JWT ---
$jSecret = "nexogc/prod/jwt"
$exists = aws secretsmanager describe-secret --region $region --secret-id $jSecret --query "ARN" --output text 2>$null
if ($exists -and $exists -ne "None") { Write-Host "Secret JWT ya existe: $exists" }
else {
  $jwt = Rand 64
  $val = "{""jwt_secret"":""$jwt""}"
  aws secretsmanager create-secret --region $region --name $jSecret --description "nexogc JWT signing secret (prod)" --secret-string $val --output text | Out-Null
  Write-Host "== SECRET JWT (mostrado UNA VEZ) =="
  Write-Host "JWT_SECRET: $jwt"
  $val = $null
}

# --- S3 bucket docs (privado, versionado, cifrado) ---
$bucket = "nexogc-contratos-docs-933629770820"
$exists = aws s3api head-bucket --region $region --bucket $bucket 2>$null
if ($LASTEXITCODE -eq 0) { Write-Host "Bucket S3 ya existe: $bucket" }
else {
  aws s3api create-bucket --region $region --bucket $bucket --output text | Out-Null
  aws s3api put-public-access-block --region $region --bucket $bucket --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" --output text | Out-Null
  aws s3api put-bucket-versioning --region $region --bucket $bucket --versioning-configuration "Status=Enabled" --output text | Out-Null
  aws s3api put-bucket-encryption --region $region --bucket $bucket --server-side-encryption-configuration "Rules=[{ApplyServerSideEncryptionByDefault={SSEAlgorithm=aws:kms},BucketKeyEnabled=true}]" --output text 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { aws s3api put-bucket-encryption --region $region --bucket $bucket --server-side-encryption-configuration "Rules=[{ApplyServerSideEncryptionByDefault={SSEAlgorithm=AES256}}]" --output text | Out-Null }
  # Lifecycle: versiones no actuales a IA a 30 dias, expiracion de versiones no actuales a 90 dias
  aws s3api put-bucket-lifecycle-configuration --region $region --bucket $bucket --lifecycle-configuration "Rules=[{ID=nexogc-docs-lifecycle,Status=Enabled,Filter={},Transitions=[{Days=30,StorageClass=STANDARD_IA}],NoncurrentVersionTransitions=[{Days=7,StorageClass=STANDARD_IA}],NoncurrentVersionExpiration={Days=90}}]" --output text | Out-Null
  Write-Host "Bucket S3 creado: $bucket"
}

Write-Host "== Secrets + S3 OK =="
