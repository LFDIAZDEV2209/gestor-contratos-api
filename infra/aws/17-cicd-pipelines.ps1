# nexogc - 17 CI/CD: circuit breaker, conexion GitHub, proyectos CodeBuild, pipelines y EventBridge.
# Idempotente: re-ejecucion actualiza proyectos/pipelines. Requiere 16-cicd-iam.ps1 ejecutado.
# PASO MANUAL UNICO tras crear la conexion (PENDING_HANDSHAKE):
#   https://console.aws.amazon.com/codesuite/connections/connections?region=us-east-1
#   -> "Update pending connection" -> instalar GitHub App y dar acceso a los dos repos.
# EAP=Continue: en PS 5.1 el stderr de aws abortaria con Stop; cada paso critico se valida con Guard.
$ErrorActionPreference = "Continue"
$region = "us-east-1"
$account = "933629770820"
$bucket = "nexogc-artifacts-$account"
$snsArn = "arn:aws:sns:${region}:${account}:nexogc-alarms"
$cluster = "nexogc-cluster"
$tmp = Join-Path $env:TEMP "nexogc-cicd"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$pipelineRole = "arn:aws:iam::${account}:role/nexogc-cicd-pipeline-role"
$buildRole    = "arn:aws:iam::${account}:role/nexogc-cicd-build-role"
$migrateRole  = "arn:aws:iam::${account}:role/nexogc-cicd-migrate-role"
$deployRole   = "arn:aws:iam::${account}:role/nexogc-cicd-deploy-role"

function Write-JsonFile($path, $obj) {
  [System.IO.File]::WriteAllText($path, ($obj | ConvertTo-Json -Depth 12))
}
function Guard($step) {
  if ($LASTEXITCODE -ne 0) { throw "Fallo en: $step (exit $LASTEXITCODE)" }
}
function Write-TextFile($path, $text) {
  [System.IO.File]::WriteAllText($path, $text)
}

# --- 0) Circuit breaker con rollback automatico en los dos servicios ---
aws ecs update-service --region $region --cluster $cluster --service nexogc-api-svc --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true}" --query "service.serviceName" --output text | Out-Null
Guard "circuit-breaker api-svc"
aws ecs update-service --region $region --cluster $cluster --service nexogc-front-svc --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true}" --query "service.serviceName" --output text | Out-Null
Guard "circuit-breaker front-svc"
Write-Host "Circuit breaker + rollback automatico activados en nexogc-api-svc y nexogc-front-svc"

# --- 1) Conexion GitHub (CodeStar Connections) ---
$conn = aws codestar-connections list-connections --region $region --query "Connections[?ConnectionName=='nexogc-github'].ConnectionArn" --output text
if (-not $conn -or $conn -eq "None") {
  $conn = aws codestar-connections create-connection --region $region --provider-type GitHub --connection-name nexogc-github --query ConnectionArn --output text
  Guard "create-connection GitHub"
  Write-Host "Conexion creada (PENDING_HANDSHAKE): $conn"
} else {
  Write-Host "Conexion existente: $conn"
}
$conn = $conn.Trim()

# --- 2) Proyectos CodeBuild (source = CODEPIPELINE; el buildspec vive versionado en el repo) ---
function New-ProjectJson($name, $desc, $spec, $role) {
  @{
    name = $name
    description = $desc
    source = @{ type = "CODEPIPELINE"; buildspec = $spec }
    artifacts = @{ type = "CODEPIPELINE" }
    environment = @{
      type = "LINUX_CONTAINER"
      image = "aws/codebuild/standard:7.0"
      computeType = "BUILD_GENERAL1_MEDIUM"
      privilegedMode = $true
    }
    serviceRole = $role
    timeoutInMinutes = 60
    queuedTimeoutInMinutes = 10
    logsConfig = @{ cloudWatchLogs = @{ status = "ENABLED"; groupName = "/nexogc/cicd" } }
  }
}
function Ensure-Project($obj) {
  $file = "$tmp\proj-$($obj.name).json"
  Write-JsonFile $file $obj
  $out = aws codebuild create-project --region $region --cli-input-json "file://$file" --output json 2>&1
  if ($LASTEXITCODE -ne 0) {
    if ("$out" -match "already exists|ResourceAlreadyExistsException|DuplicateResourceException") {
      aws codebuild update-project --region $region --cli-input-json "file://$file" --query "project.name" --output text | Out-Null
      Write-Host "Proyecto actualizado: $($obj.name)"
    } else { throw "create-project $($obj.name): $out" }
  } else { Write-Host "Proyecto creado: $($obj.name)" }
}

Ensure-Project (New-ProjectJson "nexogc-api-build"   "nexogc: test + build + push ECR del API"       "infra/aws/buildspecs/api.build.yml"   $buildRole)
Ensure-Project (New-ProjectJson "nexogc-api-migrate" "nexogc: migraciones TypeORM task one-off ECS"  "infra/aws/buildspecs/api.migrate.yml" $migrateRole)
Ensure-Project (New-ProjectJson "nexogc-api-deploy"  "nexogc: update-service + wait stable API"      "infra/aws/buildspecs/api.deploy.yml"  $deployRole)
Ensure-Project (New-ProjectJson "nexogc-front-build" "nexogc: build + push ECR del front Next SSR"   "infra/buildspecs/build.yml"           $buildRole)
Ensure-Project (New-ProjectJson "nexogc-front-deploy" "nexogc: update-service + wait stable front"   "infra/buildspecs/deploy.yml"          $deployRole)

# --- 3) Pipelines (Source GitHub main -> Build -> [Migrate] -> Deploy) ---
$sourceAction = {
  param($repoId, $outName)
  @{
    name = "GitHub"; runOrder = 1
    actionTypeId = @{ category = "Source"; owner = "AWS"; version = "1"; provider = "CodeStarSourceConnection" }
    configuration = @{ ConnectionArn = $conn; FullRepositoryId = $repoId; BranchName = "main" }
    outputArtifacts = @(@{ name = $outName })
  }
}
$buildAction = {
  param($project, $inName, $outName)
  @{
    name = "Build"; runOrder = 1
    actionTypeId = @{ category = "Build"; owner = "AWS"; version = "1"; provider = "CodeBuild" }
    configuration = @{ ProjectName = $project }
    inputArtifacts = @(@{ name = $inName })
    outputArtifacts = @(@{ name = $outName })
  }
}
$invokeAction = {
  param($name, $project, $inName)
  @{
    name = $name; runOrder = 1
    actionTypeId = @{ category = "Build"; owner = "AWS"; version = "1"; provider = "CodeBuild" }
    configuration = @{ ProjectName = $project }
    inputArtifacts = @(@{ name = $inName })
  }
}

$apiPipeline = @{
  name = "nexogc-api-pipeline"
  roleArn = $pipelineRole
  artifactStore = @{ type = "S3"; location = $bucket }
  stages = @(
    @{ name = "Source";  actions = @(& $sourceAction "LFDIAZDEV2209/gestor-contratos-api" "Source") },
    @{ name = "Build";   actions = @(& $buildAction "nexogc-api-build" "Source" "BuildOut") },
    @{ name = "Migrate"; actions = @(& $invokeAction "Migrate" "nexogc-api-migrate" "BuildOut") },
    @{ name = "Deploy";  actions = @(& $invokeAction "Deploy" "nexogc-api-deploy" "BuildOut") }
  )
}

$frontPipeline = @{
  name = "nexogc-front-pipeline"
  roleArn = $pipelineRole
  artifactStore = @{ type = "S3"; location = $bucket }
  stages = @(
    @{ name = "Source"; actions = @(& $sourceAction "LFDIAZDEV2209/gestor-contratos-front" "Source") },
    @{ name = "Build";  actions = @(& $buildAction "nexogc-front-build" "Source" "BuildOut") },
    @{ name = "Deploy"; actions = @(& $invokeAction "Deploy" "nexogc-front-deploy" "BuildOut") }
  )
}

function Ensure-Pipeline($obj) {
  $file = "$tmp\pipe-$($obj.name).json"
  Write-JsonFile $file @{ pipeline = $obj }
  $out = aws codepipeline create-pipeline --region $region --cli-input-json "file://$file" --output json 2>&1
  if ($LASTEXITCODE -ne 0) {
    if ("$out" -match "already exists") {
      aws codepipeline update-pipeline --region $region --cli-input-json "file://$file" --query "version" --output text | Out-Null
      Write-Host "Pipeline actualizado: $($obj.name)"
    } else { throw "create-pipeline $($obj.name): $out" }
  } else { Write-Host "Pipeline creado: $($obj.name)" }
}
Ensure-Pipeline $apiPipeline
Ensure-Pipeline $frontPipeline

# --- 4) EventBridge: fallos de pipeline y rollback de circuit breaker -> SNS nexogc-alarms ---
# Los patterns van a fichero: PS 5.1 altera las comillas si se pasan inline.
Write-TextFile "$tmp\pat-pipeline.json" '{"source":["aws.codepipeline"],"detail-type":["CodePipeline Pipeline Execution State Change"],"detail":{"state":["FAILED"]}}'
aws events put-rule --region $region --name nexogc-pipeline-failed --event-pattern "file://$tmp\pat-pipeline.json" --no-cli-pager | Out-Null
Guard "put-rule pipeline-failed"
aws events put-targets --region $region --rule nexogc-pipeline-failed --targets "Id=nexogc-sns,Arn=$snsArn" --no-cli-pager | Out-Null
Guard "put-targets pipeline-failed"

Write-TextFile "$tmp\pat-cb.json" '{"source":["aws.ecs"],"detail-type":["ECS Deployment Circuit Breaker Events"]}'
aws events put-rule --region $region --name nexogc-ecs-circuit-breaker --event-pattern "file://$tmp\pat-cb.json" --no-cli-pager | Out-Null
Guard "put-rule circuit-breaker"
aws events put-targets --region $region --rule nexogc-ecs-circuit-breaker --targets "Id=nexogc-sns,Arn=$snsArn" --no-cli-pager | Out-Null
Guard "put-targets circuit-breaker"
Write-Host "EventBridge: fallos de pipeline y rollback ECS -> SNS nexogc-alarms"

Write-Host "== 17-cicd-pipelines OK =="
if ($conn) {
  $status = aws codestar-connections get-connection --region $region --connection-arn $conn --query "Connection.ConnectionStatus" --output text
  Write-Host "Estado de la conexion: $status"
  if ($status -ne "AVAILABLE") {
    Write-Host "PENDIENTE MANUAL: completar handshake de la conexion en:"
    Write-Host "https://console.aws.amazon.com/codesuite/connections/connections?region=us-east-1"
  }
}
