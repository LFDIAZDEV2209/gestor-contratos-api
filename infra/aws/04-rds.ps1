# nexogc - RDS PostgreSQL 16 prod: private data subnets, t4g.small, 50GB gp3 autoscale,
# backups 7d + PITR, cifrado, sin acceso publico, deletion protection. Single-AZ (documentado escalar a Multi-AZ).
$ErrorActionPreference = "Continue"
$region = "us-east-1"
$T = 'Key=Project,Value=nexo-gestor-contratos Key=Env,Value=prod'

# --- Subnet group ---
$sgn = aws rds describe-db-subnet-groups --region $region --query "DBSubnetGroups[?DBSubnetGroupName=='nexogc-db-subnets'].DBSubnetGroupName" --output text
if ($sgn -and $sgn -ne "None") { Write-Host "Subnet group ya existe" }
else {
  $subA = aws ec2 describe-subnets --region $region --filters Name=tag:Name,Values=nexogc-data-a --query "Subnets[0].SubnetId" --output text
  $subB = aws ec2 describe-subnets --region $region --filters Name=tag:Name,Values=nexogc-data-b --query "Subnets[0].SubnetId" --output text
  aws rds create-db-subnet-group --region $region --db-subnet-group-name nexogc-db-subnets --db-subnet-group-description "nexogc prod data subnets" --subnet-ids $subA $subB --output text | Out-Null
  Write-Host "DB subnet group creado"
}

# --- Parameter group (slow query log 500ms) ---
$pg = aws rds describe-db-parameter-groups --region $region --query "DBParameterGroups[?DBParameterGroupName=='nexogc-pg16'].DBParameterGroupName" --output text
if ($pg -and $pg -ne "None") { Write-Host "Parameter group ya existe" }
else {
  aws rds create-db-parameter-group --region $region --db-parameter-group-name nexogc-pg16 --db-parameter-group-family postgres16 --description "nexogc prod params" --output text | Out-Null
  aws rds modify-db-parameter-group --region $region --db-parameter-group-name nexogc-pg16 --parameters "ParameterName=log_min_duration_statement,ParameterValue=500,ApplyMethod=immediate" "ParameterName=log_statement,ParameterValue=none,ApplyMethod=immediate" --output text | Out-Null
  Write-Host "Parameter group creado"
}

# --- Credenciales desde Secrets Manager (regex tolerante: PS 5.1 quita comillas del output nativo) ---
$raw = aws secretsmanager get-secret-value --region $region --secret-id nexogc/prod/db --query SecretString --output text
$dbUser = [regex]::Match($raw, 'username\s*:\s*([^,}]+)').Groups[1].Value
$dbPass = [regex]::Match($raw, 'password\s*:\s*([^,}]+)').Groups[1].Value
if (-not $dbUser) { throw "No se pudo parsear el secret nexogc/prod/db" }
Write-Host "Credenciales DB cargadas (usuario: $dbUser)"

# --- Instancia ---
$inst = aws rds describe-db-instances --region $region --query "DBInstances[?DBInstanceIdentifier=='nexogc-db-prod'].DBInstanceIdentifier" --output text
if ($inst -and $inst -ne "None") { Write-Host "RDS ya existe: $inst" }
else {
  $dbSg = aws ec2 describe-security-groups --region $region --filters Name=group-name,Values=nexogc-sg-db --query "SecurityGroups[0].GroupId" --output text
  aws rds create-db-instance --region $region --db-instance-identifier nexogc-db-prod --engine postgres --engine-version 16.10 --db-instance-class db.t4g.small --allocated-storage 50 --storage-type gp3 --max-allocated-storage 500 --master-username $dbUser --master-user-password $dbPass --db-name gestor_contratos --vpc-security-group-ids $dbSg --db-subnet-group-name nexogc-db-subnets --db-parameter-group-name nexogc-pg16 --no-publicly-accessible --storage-encrypted --backup-retention-period 7 --preferred-backup-window "03:00-03:30" --preferred-maintenance-window "mon:04:00-mon:04:30" --copy-tags-to-snapshot --deletion-protection --auto-minor-version-upgrade --output text | Out-Null
  Write-Host "RDS creando: nexogc-db-prod (tarda ~5 min)"
}


