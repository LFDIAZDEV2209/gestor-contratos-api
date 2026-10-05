# nexogc - IAM (roles ECS, S3 minimo privilegio), ECR, CloudWatch Logs, ECS cluster.
# Estrategia JSON: se escribe a archivo temporal y se pasa via file:// (evita parsing de PS 5.1).
$ErrorActionPreference = "Continue"
$region = "us-east-1"
$account = "933629770820"
$bucket = "nexogc-contratos-docs-933629770820"
$tmp = Join-Path $env:TEMP "nexogc-iam"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

function Write-Json($path, $json) { [System.IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding $false)) }

# --- Trust policy ECS ---
$trustFile = "$tmp\trust.json"
Write-Json $trustFile '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
$tagsFile = "$tmp\tags.json"
Write-Json $tagsFile '[{"Key":"Project","Value":"nexo-gestor-contratos"},{"Key":"Env","Value":"prod"}]'

# --- Rol de ejecucion de tareas ECS (pull ECR + logs + secrets) ---
$rol = "nexogc-ecs-execution-role"
$exists = aws iam get-role --role-name $rol --query "Role.Arn" --output text 2>$null
if (-not $exists -or $exists -eq "None") {
  aws iam create-role --region $region --role-name $rol --assume-role-policy-document "file://$trustFile" --tags "file://$tagsFile" --output text | Out-Null
  Write-Host "Rol creado: $rol"
}
aws iam attach-role-policy --region $region --role-name $rol --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy" --output text 2>$null | Out-Null
$secretsPolicyFile = "$tmp\secrets-policy.json"
Write-Json $secretsPolicyFile ('{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["secretsmanager:GetSecretValue"],"Resource":["arn:aws:secretsmanager:us-east-1:' + $account + ':secret:nexogc/*"]}]}')
aws iam put-role-policy --region $region --role-name $rol --policy-name nexogc-secrets-read --policy-document "file://$secretsPolicyFile" --output text | Out-Null
Write-Host "Execution role OK: $rol"

# --- Rol de tarea (S3 bucket docs, minimo privilegio por prefix) ---
$rolT = "nexogc-ecs-task-role"
$exists = aws iam get-role --role-name $rolT --query "Role.Arn" --output text 2>$null
if (-not $exists -or $exists -eq "None") {
  aws iam create-role --region $region --role-name $rolT --assume-role-policy-document "file://$trustFile" --tags "file://$tagsFile" --output text | Out-Null
  Write-Host "Rol creado: $rolT"
}
$taskPolicyFile = "$tmp\task-policy.json"
Write-Json $taskPolicyFile ('{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:ListBucket"],"Resource":["arn:aws:s3:::' + $bucket + '"],"Condition":{"StringLike":{"s3:prefix":["contratos/*"]}}},{"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":["arn:aws:s3:::' + $bucket + '/contratos/*"]}]}')
aws iam put-role-policy --region $region --role-name $rolT --policy-name nexogc-s3-docs-rw --policy-document "file://$taskPolicyFile" --output text | Out-Null
Write-Host "Task role OK: $rolT"

# --- ECR repo con scan ---
$ecr = "nexogc/api"
$ecrUri = aws ecr describe-repositories --region $region --repository-names $ecr --query "repositories[0].repositoryUri" --output text 2>$null
if ($ecrUri -and $ecrUri -ne "None") { Write-Host "ECR ya existe: $ecrUri" }
else {
  $ecrFile = "$tmp\ecr.json"
  Write-Json $ecrFile '{"repositoryName":"nexogc/api","imageScanningConfiguration":{"scanOnPush":true},"encryptionConfiguration":{"encryptionType":"AES256"},"tags":[{"Key":"Project","Value":"nexo-gestor-contratos"},{"Key":"Env","Value":"prod"}]}'
  $ecrUri = aws ecr create-repository --region $region --cli-input-json "file://$ecrFile" --query "repository.repositoryUri" --output text
  Write-Host "ECR creado: $ecrUri"
}

# --- CloudWatch log groups (sin tags en creacion: se agregan luego si se necesita) ---
foreach ($lg in @('/nexogc/api-prod','/nexogc/migration')) {
  $lgExists = aws logs describe-log-groups --region $region --log-group-name-prefix $lg --query "logGroups[?logGroupName=='$lg'].logGroupName" --output text
  if ($lgExists -and $lgExists -ne "None") { Write-Host "Log group ya existe: $lg" }
  else {
    aws logs create-log-group --region $region --log-group-name $lg --output text | Out-Null
    aws logs put-retention-policy --region $region --log-group-name $lg --retention-in-days 30 --output text | Out-Null
    Write-Host "Log group creado: $lg (retencion 30d)"
  }
}

# --- ECS cluster ---
$cl = aws ecs describe-clusters --region $region --clusters nexogc-cluster --query "clusters[0].clusterName" --output text 2>$null
if ($cl -and $cl -ne "None" -and $cl -ne "null") { Write-Host "Cluster ya existe: $cl" }
else {
  aws ecs create-cluster --region $region --cluster-name nexogc-cluster --capacity-providers FARGATE --output text | Out-Null
  Write-Host "Cluster creado: nexogc-cluster (FARGATE)"
}

Write-Host "== IAM/ECR/ECS OK =="
