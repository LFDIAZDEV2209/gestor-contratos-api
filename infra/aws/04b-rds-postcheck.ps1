# nexogc - Postcheck: espera RDS available, actualiza secret con endpoint, verifica Valkey.
$ErrorActionPreference = "Continue"
$region = "us-east-1"

Write-Host "Esperando RDS nexogc-db-prod available (max 12 min)..."
$null = aws rds wait db-instance-available --region $region --db-instance-identifier nexogc-db-prod 2>$null
$rds = aws rds describe-db-instances --region $region --db-instance-identifier nexogc-db-prod --query "DBInstances[0].[Endpoint.Address,Endpoint.Port,DBInstanceStatus,EngineVersion]" --output json | ConvertFrom-Json
Write-Host "RDS: $($rds[0]):$($rds[1]) status=$($rds[2]) version=$($rds[3])"

# Actualizar secret nexogc/prod/db con host/endpoint
if ($rds[0] -and $rds[0] -ne "None") {
  $raw = aws secretsmanager get-secret-value --region $region --secret-id nexogc/prod/db --query SecretString --output text
  $user = [regex]::Match($raw, 'username\s*:\s*([^,}]+)').Groups[1].Value
  $pass = [regex]::Match($raw, 'password\s*:\s*([^,}]+)').Groups[1].Value
  $val = "{""username"":""$user"",""password"":""$pass"",""engine"":""postgres"",""host"":""$($rds[0])"",""port"":$($rds[1]),""dbname"":""gestor_contratos"",""dbInstanceIdentifier"":""nexogc-db-prod"",""sslMode"":""require""}"
  aws secretsmanager put-secret-value --region $region --secret-id nexogc/prod/db --secret-string $val --output text | Out-Null
  Write-Host "Secret nexogc/prod/db actualizado con endpoint"
}

Write-Host "Esperando Valkey nexogc-valkey-prod available (max 10 min)..."
$null = aws elasticache wait replication-group-available --region $region --replication-group-id nexogc-valkey-prod 2>$null
$v = aws elasticache describe-replication-groups --region $region --replication-group-id nexogc-valkey-prod --query "ReplicationGroups[0].[Status,ConfigurationEndpoint.Address,ConfigurationEndpoint.Port]" --output json | ConvertFrom-Json
Write-Host "Valkey: $($v[1]):$($v[2]) status=$($v[0])"

Write-Host "== Postcheck OK =="
