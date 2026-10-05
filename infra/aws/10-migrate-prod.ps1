# nexogc - Migraciones contra RDS prod: task one-off de ECS (run-task) en subnets privadas de app.
# Nunca migrar destructivo automatico: este script corre MIGRACIONES PENDIENTES (no destructive).
$ErrorActionPreference = "Continue"
$region = "us-east-1"
$account = "933629770820"
$appA = aws ec2 describe-subnets --region $region --filters Name=tag:Name,Values=nexogc-app-a --query "Subnets[0].SubnetId" --output text
$appB = aws ec2 describe-subnets --region $region --filters Name=tag:Name,Values=nexogc-app-b --query "Subnets[0].SubnetId" --output text
$appSg = aws ec2 describe-security-groups --region $region --filters Name=group-name,Values=nexogc-sg-app --query "SecurityGroups[0].GroupId" --output text
$cluster = "nexogc-cluster"

# Busca el taskdef de migracion o clona el de api
$tdExists = aws ecs describe-task-definition --region $region --task-definition nexogc-migration --query "taskDefinition.taskDefinitionArn" --output text 2>$null
if (-not $tdExists -or $tdExists -eq "None") {
  $apiTd = aws ecs describe-task-definition --region $region --task-definition nexogc-api --query "taskDefinition" --output json | ConvertFrom-Json
  $clone = $apiTd
  $clone.family = "nexogc-migration"
  $clone.containerDefinitions[0].image = $null  # usa la latest del repo al registrar? se mantiene image del api td
  $clone.containerDefinitions[0].command = @("node", "node_modules/typeorm/cli.js", "migration:run", "-d", "dist/database/data-source.js")
  $clone.containerDefinitions[0].healthCheck = $null
  $null = $clone.PSObject.Properties.Remove("revision")
  $null = $clone.PSObject.Properties.Remove("taskDefinitionArn")
  $null = $clone.PSObject.Properties.Remove("requiresAttributes")
  $null = $clone.PSObject.Properties.Remove("compatibilities")
  $null = $clone.PSObject.Properties.Remove("status")
  $null = $clone.PSObject.Properties.Remove("registeredAt")
  $null = $clone.PSObject.Properties.Remove("registeredBy")
  $json = $clone | ConvertTo-Json -Depth 10
  $file = "$env:TEMP\nexogc-migration-td.json"
  [System.IO.File]::WriteAllText($file, $json)
  $tdArn = (aws ecs register-task-definition --region $region --cli-input-json "file://$file" --query "taskDefinition.taskDefinitionArn" --output text)
  Write-Host "Taskdef migracion registrada: $tdArn"
} else { $tdArn = $tdExists }

$tdArn = aws ecs describe-task-definition --region $region --task-definition nexogc-migration --query "taskDefinition.taskDefinitionArn" --output text

# run-task one-off
$task = aws ecs run-task --region $region --cluster $cluster --task-definition $tdArn `
  --launch-type FARGATE `
  --network-configuration "awsvpcConfiguration={subnets=[$appA,$appB],securityGroups=[$appSg],assignPublicIp=DISABLED}" `
  --started-by "infra-migrate-script" --query "tasks[0].taskArn" --output text
if ($LASTEXITCODE -ne 0) { throw "run-task fallo" }
Write-Host "Task de migracion lanzada: $task (verifica con: aws ecs wait tasks-stopped)"
