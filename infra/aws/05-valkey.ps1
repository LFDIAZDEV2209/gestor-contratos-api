# nexogc - ElastiCache for Valkey: private data subnets, cache.t4g.micro single node,
# TLS in transit + auth token (secret), snapshots 3d. Single node (documentado escalar a replica + multi-AZ).
$ErrorActionPreference = "Continue"
$region = "us-east-1"

# --- Subnet group ---
$sgn = aws elasticache describe-cache-subnet-groups --region $region --query "CacheSubnetGroups[?CacheSubnetGroupName=='nexogc-cache-subnets'].CacheSubnetGroupName" --output text
if ($sgn -and $sgn -ne "None") { Write-Host "Cache subnet group ya existe" }
else {
  $subA = aws ec2 describe-subnets --region $region --filters Name=tag:Name,Values=nexogc-data-a --query "Subnets[0].SubnetId" --output text
  $subB = aws ec2 describe-subnets --region $region --filters Name=tag:Name,Values=nexogc-data-b --query "Subnets[0].SubnetId" --output text
  aws elasticache create-cache-subnet-group --region $region --cache-subnet-group-name nexogc-cache-subnets --cache-subnet-group-description "nexogc prod data subnets" --subnet-ids $subA $subB --output text | Out-Null
  Write-Host "Cache subnet group creado"
}

# --- Auth token desde secret (regex tolerante) ---
$raw = aws secretsmanager get-secret-value --region $region --secret-id nexogc/prod/valkey --query SecretString --output text
$vToken = [regex]::Match($raw, 'auth_token\s*:\s*([^,}]+)').Groups[1].Value
if (-not $vToken) { throw "No se pudo parsear el secret nexogc/prod/valkey" }

# --- Replication group (single node Valkey 8) ---
$rg = aws elasticache describe-replication-groups --region $region --query "ReplicationGroups[?ReplicationGroupId=='nexogc-valkey-prod'].ReplicationGroupId" --output text
if ($rg -and $rg -ne "None") { Write-Host "Valkey ya existe: $rg" }
else {
  $cacheSg = aws ec2 describe-security-groups --region $region --filters Name=group-name,Values=nexogc-sg-cache --query "SecurityGroups[0].GroupId" --output text
  aws elasticache create-replication-group --region $region --replication-group-id nexogc-valkey-prod --description "nexogc prod Valkey cache" --engine valkey --engine-version 8.0 --cache-node-type cache.t4g.micro --num-node-groups 1 --replicas-per-node-group 0 --cache-subnet-group-name nexogc-cache-subnets --security-group-ids $cacheSg --transit-encryption-mode required --auth-token $vToken --snapshot-retention-limit 3 --snapshot-window "04:00-05:00" --preferred-maintenance-window "mon:05:00-mon:06:00" --automatic-failover-disabled --output text | Out-Null
  Write-Host "Valkey creando: nexogc-valkey-prod"
}
