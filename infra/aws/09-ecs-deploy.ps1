# nexogc - Deploy: build imagen, push ECR, taskdef, ECS service (Fargate 0.5vCPU/1GB x2).
# Requiere: RDS y Valkey en available, secret DB con endpoint actualizado (04-rds-postcheck.ps1).
$ErrorActionPreference = "Continue"
$region = "us-east-1"
$account = "933629770820"
$ecrUri = "$account.dkr.ecr.$region.amazonaws.com/nexogc/api"
$image = "${ecrUri}:latest"
$tmp = Join-Path $env:TEMP "nexogc-ecs"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

# --- 1) Build imagen ---
Push-Location C:\Users\Luis\Documents\Nexo\Repos\gestor-contratos-api
docker build -t $image . 2>&1 | Select-Object -Last 5
Pop-Location
if ($LASTEXITCODE -ne 0) { throw "docker build fallo" }

# --- 2) Login ECR + push ---
$pass = aws ecr get-login-password --region $region
docker login --username AWS --password $pass $ecrUri 2>$null | Out-Null
docker push $image 2>&1 | Select-Object -Last 3
if ($LASTEXITCODE -ne 0) { throw "docker push fallo" }
Write-Host "Imagen en ECR: $image"

# --- 3) Credenciales/ARNs para el taskdef ---
$execRole = (aws iam get-role --role-name nexogc-ecs-execution-role --query "Role.Arn" --output text)
$taskRole = (aws iam get-role --role-name nexogc-ecs-task-role --query "Role.Arn" --output text)
$rds = aws rds describe-db-instances --region $region --db-instance-identifier nexogc-db-prod --query "DBInstances[0].[Endpoint.Address,Endpoint.Port,DBInstanceStatus]" --output json
$endpJson = $rds | ConvertFrom-Json
$dbEndpoint = $endpJson[0]
$dbPort = $endpJson[1]
$dbStatus = $endpJson[2]
Write-Host "RDS: $dbEndpoint : $dbPort ($dbStatus)"
$valkey = aws elasticache describe-replication-groups --region $region --replication-group-id nexogc-valkey-prod --query "ReplicationGroups[0].[NodeGroups[0].PrimaryEndpoint.Address,NodeGroups[0].PrimaryEndpoint.Port,Status]" --output json | ConvertFrom-Json
$valkeyEndpoint = $valkey[0]; $valkeyPort = $valkey[1]; $valkeyStatus = $valkey[2]
Write-Host "Valkey: $valkeyEndpoint : $valkeyPort ($valkeyStatus)"
$tg = aws elbv2 describe-target-groups --region $region --names nexogc-tg-api --query "TargetGroups[0].TargetGroupArn" --output text
$vpcId = aws ec2 describe-vpcs --region us-east-1 --filters Name=tag:Project,Values=nexo-gestor-contratos --query "Vpcs[0].VpcId" --output text
$appA = aws ec2 describe-subnets --region $region --filters Name=tag:Name,Values=nexogc-app-a --query "Subnets[0].SubnetId" --output text
$appB = aws ec2 describe-subnets --region $region --filters Name=tag:Name,Values=nexogc-app-b --query "Subnets[0].SubnetId" --output text
$appA = aws ec2 describe-subnets --region $region --filters Name=tag:Name,Values=nexogc-app-a --query "Subnets[0].SubnetId" --output text
$appB = aws ec2 describe-subnets --region $region --filters Name=tag:Name,Values=nexogc-app-b --query "Subnets[0].SubnetId" --output text
# ARNs REALES de los secrets (el sufijo aleatorio lo genera Secrets Manager)
$arnDb = aws secretsmanager describe-secret --region $region --secret-id nexogc/prod/db --query "ARN" --output text
$arnJwt = aws secretsmanager describe-secret --region $region --secret-id nexogc/prod/jwt --query "ARN" --output text
$arnValkey = aws secretsmanager describe-secret --region $region --secret-id nexogc/prod/valkey --query "ARN" --output text
Write-Host "ARNs: db=$arnDb jwt=$arnJwt valkey=$arnValkey"

# --- 4) Task definition ---
$td = @{
  family = "nexogc-api"
  requiresCompatibilities = @("FARGATE")
  networkMode = "awsvpc"
  cpu = "512"
  memory = "1024"
  executionRoleArn = $execRole
  taskRoleArn = $taskRole
  containerDefinitions = @(
    @{
      name = "api"
      image = $image
      portMappings = @(@{ containerPort = 4000; protocol = "tcp" })
      essential = $true
      logConfiguration = @{ logDriver = "awslogs"; options = @{ "awslogs-group" = "/nexogc/api-prod"; "awslogs-region" = $region; "awslogs-stream-prefix" = "api" } }
      environment = @(
        @{ name = "NODE_ENV"; value = "production" },
        @{ name = "PORT"; value = "4000" },
        @{ name = "DB_HOST"; value = $dbEndpoint },
        @{ name = "DB_PORT"; value = "$dbPort" },
        @{ name = "DB_NAME"; value = "gestor_contratos" },
        @{ name = "VALKEY_HOST"; value = $valkeyEndpoint },
        @{ name = "VALKEY_PORT"; value = "$valkeyPort" },
        @{ name = "VALKEY_TLS"; value = "true" },
        @{ name = "CACHE_DRIVER"; value = "valkey" },
        @{ name = "S3_BUCKET"; value = "nexogc-contratos-docs-933629770820" },
        @{ name = "AWS_REGION"; value = $region },
        @{ name = "CORS_ORIGIN"; value = "https://nexogc.fyatech.com,http://localhost:3000" },
        @{ name = "ALERT_CRON"; value = "0 6 * * *" },
        @{ name = "UPLOAD_DIR"; value = "/app/data/uploads" }
      )
      secrets = @(
        @{ name = "DB_USER"; valueFrom = ($arnDb + ":username::") },
        @{ name = "DB_PASSWORD"; valueFrom = ($arnDb + ":password::") },
        @{ name = "JWT_SECRET"; valueFrom = ($arnJwt + ":jwt_secret::") },
        @{ name = "VALKEY_PASSWORD"; valueFrom = ($arnValkey + ":auth_token::") }
      )
      healthCheck = @{ command = @("CMD-SHELL", "wget -qO- http://127.0.0.1:4000/api/health/live || exit 1"); interval = 30; timeout = 5; retries = 3; startPeriod = 60 }
    }
  )
} | ConvertTo-Json -Depth 10
$tdFile = "$tmp\taskdef.json"
[System.IO.File]::WriteAllText($tdFile, $td)
$tdArn = (aws ecs register-task-definition --region $region --cli-input-json "file://$tdFile" --query "taskDefinition.taskDefinitionArn" --output text)
Write-Host "Task def registrada: $tdArn"

# --- 5) ECS service (2 tasks, rolling) ---
$svc = aws ecs describe-services --region $region --cluster nexogc-cluster --services nexogc-api-svc --query "services[0].serviceName" --output text 2>$null
if ($svc -and $svc -ne "None" -and $svc -ne "null") {
  aws ecs update-service --region $region --cluster nexogc-cluster --service nexogc-api-svc --task-definition $tdArn --desired-count 2 --output text | Out-Null
  Write-Host "Service actualizado a taskdef nueva"
} else {
$appSg = aws ec2 describe-security-groups --region $region --filters Name=group-name,Values=nexogc-sg-app --query "SecurityGroups[0].GroupId" --output text
  aws ecs create-service --region $region --cluster nexogc-cluster --service-name nexogc-api-svc --task-definition $tdArn --desired-count 2 --launch-type FARGATE --load-balancers "targetGroupArn=$tg,containerName=api,containerPort=4000" --health-check-grace-period-seconds 90 --network-configuration "awsvpcConfiguration={subnets=[$appA,$appB],securityGroups=[$appSg],assignPublicIp=DISABLED}" --output text | Out-Null
  Write-Host "Service creado: nexogc-api-svc (2 tasks)"
}

Write-Host "== DEPLOY OK. URL: http://nexogc-alb-prod-651088037.us-east-1.elb.amazonaws.com/api/health =="
