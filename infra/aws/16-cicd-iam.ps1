# nexogc - 16 CI/CD IAM: bucket de artifacts + roles CodePipeline/CodeBuild + policy SNS para EventBridge.
# Idempotente: crea solo lo que falta; policies inline se reescriben en cada ejecucion.
# Ejecutar ANTES de 17-cicd-pipelines.ps1. Requiere AWS CLI con perfil admin (region us-east-1).
# EAP=Continue: en PS 5.1 el stderr de aws (head-bucket/get-role cuando no existe) abortaria con Stop.
# Cada paso critico se valida con Guard usando $LASTEXITCODE.
$ErrorActionPreference = "Continue"
$region = "us-east-1"
$account = "933629770820"
$bucket = "nexogc-artifacts-$account"
$snsArn = "arn:aws:sns:${region}:${account}:nexogc-alarms"
$execRoleArn = "arn:aws:iam::${account}:role/nexogc-ecs-execution-role"
$taskRoleArn = "arn:aws:iam::${account}:role/nexogc-ecs-task-role"
$tmp = Join-Path $env:TEMP "nexogc-cicd"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

function Write-JsonFile($path, $obj) {
  [System.IO.File]::WriteAllText($path, ($obj | ConvertTo-Json -Depth 12))
}
function Guard($step) {
  if ($LASTEXITCODE -ne 0) { throw "Fallo en: $step (exit $LASTEXITCODE)" }
}

# --- 1) Bucket de artifacts de CodePipeline ---
aws s3api head-bucket --bucket $bucket --region $region 2>$null
if ($LASTEXITCODE -ne 0) {
  aws s3api create-bucket --bucket $bucket --region $region --no-cli-pager | Out-Null
  Write-Host "Bucket creado: $bucket"
} else {
  Write-Host "Bucket ya existe: $bucket"
}
aws s3api put-public-access-block --bucket $bucket --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" --no-cli-pager | Out-Null
Guard "put-public-access-block"
Write-JsonFile "$tmp\enc.json" @{ Rules = @(@{ ApplyServerSideEncryptionByDefault = @{ SSEAlgorithm = "AES256" } }) }
aws s3api put-bucket-encryption --bucket $bucket --server-side-encryption-configuration "file://$tmp\enc.json" --no-cli-pager | Out-Null
Guard "put-bucket-encryption"
Write-JsonFile "$tmp\bucket-policy.json" @{
  Version = "2012-10-17"
  Statement = @(
    @{ Sid = "DenyInsecureTransport"; Effect = "Deny"; Principal = "*"; Action = "s3:*"
       Resource = @("arn:aws:s3:::$bucket", "arn:aws:s3:::$bucket/*")
       Condition = @{ Bool = @{ "aws:SecureTransport" = "false" } } }
  )
}
aws s3api put-bucket-policy --bucket $bucket --policy "file://$tmp\bucket-policy.json" --no-cli-pager | Out-Null
Guard "put-bucket-policy"
Write-JsonFile "$tmp\lifecycle.json" @{
  Rules = @(@{ ID = "abort-partials"; Prefix = "partial-artifacts/"; Status = "Enabled"
               AbortIncompleteMultipartUpload = @{ DaysAfterInitiation = 7 } })
}
aws s3api put-bucket-lifecycle-configuration --bucket $bucket --lifecycle-configuration "file://$tmp\lifecycle.json" --no-cli-pager | Out-Null
Guard "put-bucket-lifecycle-configuration"
Write-Host "Bucket configurado: SSE-AES256 + Block Public Access + deny HTTP + abort multipart 7d"

# --- 2) Roles IAM ---
Write-JsonFile "$tmp\trust-codebuild.json" @{ Version = "2012-10-17"; Statement = @(@{ Effect = "Allow"; Principal = @{ Service = "codebuild.amazonaws.com" }; Action = "sts:AssumeRole" }) }
Write-JsonFile "$tmp\trust-codepipeline.json" @{ Version = "2012-10-17"; Statement = @(@{ Effect = "Allow"; Principal = @{ Service = "codepipeline.amazonaws.com" }; Action = "sts:AssumeRole" }) }

function Ensure-Role($name, $trustFile) {
  $arn = aws iam get-role --role-name $name --query "Role.Arn" --output text 2>$null
  if ($LASTEXITCODE -ne 0) {
    $arn = aws iam create-role --role-name $name --assume-role-policy-document "file://$trustFile" --query "Role.Arn" --output text
    Guard "create-role $name"
    Write-Host "Rol creado: $name ($arn)"
  } else {
    Write-Host "Rol ya existe: $name"
  }
}
Ensure-Role "nexogc-cicd-pipeline-role" "$tmp\trust-codepipeline.json"
Ensure-Role "nexogc-cicd-build-role" "$tmp\trust-codebuild.json"
Ensure-Role "nexogc-cicd-migrate-role" "$tmp\trust-codebuild.json"
Ensure-Role "nexogc-cicd-deploy-role" "$tmp\trust-codebuild.json"

# --- 3) Policies inline de cada rol ---
# Rol del pipeline: artifacts S3 + lanzar builds + usar la conexion GitHub + pasar roles de build.
Write-JsonFile "$tmp\pol-pipeline.json" @{
  Version = "2012-10-17"
  Statement = @(
    @{ Sid = "Artifacts"; Effect = "Allow"; Action = @("s3:GetObject","s3:PutObject","s3:DeleteObject","s3:ListBucket")
       Resource = @("arn:aws:s3:::$bucket", "arn:aws:s3:::$bucket/*") },
    @{ Sid = "CodeBuild"; Effect = "Allow"
       Action = @("codebuild:StartBuild","codebuild:StopBuild","codebuild:BatchGetBuilds","codebuild:BatchGetProjects","codebuild:RetryBuild")
       Resource = "arn:aws:codebuild:${region}:${account}:project/nexogc-*" },
    @{ Sid = "UseConnection"; Effect = "Allow"; Action = "codestar-connections:UseConnection"
       Resource = "arn:aws:codestar-connections:${region}:${account}:connection/*" },
    @{ Sid = "PassBuildRoles"; Effect = "Allow"; Action = "iam:PassRole"; Resource = @(
        "arn:aws:iam::${account}:role/nexogc-cicd-build-role",
        "arn:aws:iam::${account}:role/nexogc-cicd-migrate-role",
        "arn:aws:iam::${account}:role/nexogc-cicd-deploy-role") }
  )
}
aws iam put-role-policy --role-name nexogc-cicd-pipeline-role --policy-name nexogc-cicd-pipeline --policy-document "file://$tmp\pol-pipeline.json" | Out-Null
Guard "put-role-policy pipeline"

# Rol de build: logs + artifacts + push ECR + registrar taskdef de los servicios nexogc.
Write-JsonFile "$tmp\pol-build.json" @{
  Version = "2012-10-17"
  Statement = @(
    @{ Sid = "Logs"; Effect = "Allow"; Action = @("logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents")
       Resource = @("arn:aws:logs:${region}:${account}:log-group:/nexogc/cicd*", "arn:aws:logs:${region}:${account}:log-group:/nexogc/cicd*:log-stream:*") },
    @{ Sid = "Artifacts"; Effect = "Allow"; Action = @("s3:GetObject","s3:PutObject","s3:DeleteObject")
       Resource = "arn:aws:s3:::$bucket/*" },
    @{ Sid = "ArtifactsList"; Effect = "Allow"; Action = "s3:ListBucket"; Resource = "arn:aws:s3:::$bucket" },
    @{ Sid = "EcrAuth"; Effect = "Allow"; Action = "ecr:GetAuthorizationToken"; Resource = "*" },
    @{ Sid = "EcrRepo"; Effect = "Allow"
       Action = @("ecr:BatchCheckLayerAvailability","ecr:CompleteLayerUpload","ecr:InitiateLayerUpload","ecr:PutImage","ecr:UploadLayerPart","ecr:BatchGetImage","ecr:GetDownloadUrlForLayer","ecr:DescribeImages")
       Resource = "arn:aws:ecr:${region}:${account}:repository/nexogc/*" },
    @{ Sid = "Taskdefs"; Effect = "Allow"
       Action = @("ecs:RegisterTaskDefinition")
       Resource = @("arn:aws:ecs:${region}:${account}:task-definition/nexogc-api", "arn:aws:ecs:${region}:${account}:task-definition/nexogc-api:*", "arn:aws:ecs:${region}:${account}:task-definition/nexogc-front", "arn:aws:ecs:${region}:${account}:task-definition/nexogc-front:*") },
    @{ Sid = "TaskdefRead"; Effect = "Allow"
       Action = @("ecs:DescribeTaskDefinition")
       Resource = "*" },
    @{ Sid = "PassRoles"; Effect = "Allow"; Action = "iam:PassRole"; Resource = @($execRoleArn, $taskRoleArn) }
  )
}
aws iam put-role-policy --role-name nexogc-cicd-build-role --policy-name nexogc-cicd-build --policy-document "file://$tmp\pol-build.json" | Out-Null
Guard "put-role-policy build"

# Rol de migrate: lanzar task one-off con la taskdef nueva + esperar + leer artifacts.
Write-JsonFile "$tmp\pol-migrate.json" @{
  Version = "2012-10-17"
  Statement = @(
    @{ Sid = "Logs"; Effect = "Allow"; Action = @("logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents")
       Resource = @("arn:aws:logs:${region}:${account}:log-group:/nexogc/cicd*", "arn:aws:logs:${region}:${account}:log-group:/nexogc/cicd*:log-stream:*") },
    @{ Sid = "Artifacts"; Effect = "Allow"; Action = @("s3:GetObject","s3:PutObject","s3:DeleteObject")
       Resource = "arn:aws:s3:::$bucket/*" },
    @{ Sid = "ArtifactsList"; Effect = "Allow"; Action = "s3:ListBucket"; Resource = "arn:aws:s3:::$bucket" },
    @{ Sid = "RunTask"; Effect = "Allow"; Action = "ecs:RunTask"
       Resource = @("arn:aws:ecs:${region}:${account}:task-definition/nexogc-api", "arn:aws:ecs:${region}:${account}:task-definition/nexogc-api:*") },
    @{ Sid = "ManageTasks"; Effect = "Allow"; Action = @("ecs:DescribeTasks","ecs:StopTask"); Resource = "*" },
    @{ Sid = "PassRoles"; Effect = "Allow"; Action = "iam:PassRole"; Resource = @($execRoleArn, $taskRoleArn) }
  )
}
aws iam put-role-policy --role-name nexogc-cicd-migrate-role --policy-name nexogc-cicd-migrate --policy-document "file://$tmp\pol-migrate.json" | Out-Null
Guard "put-role-policy migrate"

# Rol de deploy: actualizar los dos servicios ECS (scoped) + esperar estabilidad.
Write-JsonFile "$tmp\pol-deploy.json" @{
  Version = "2012-10-17"
  Statement = @(
    @{ Sid = "Logs"; Effect = "Allow"; Action = @("logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents")
       Resource = @("arn:aws:logs:${region}:${account}:log-group:/nexogc/cicd*", "arn:aws:logs:${region}:${account}:log-group:/nexogc/cicd*:log-stream:*") },
    @{ Sid = "Artifacts"; Effect = "Allow"; Action = @("s3:GetObject","s3:PutObject","s3:DeleteObject")
       Resource = "arn:aws:s3:::$bucket/*" },
    @{ Sid = "ArtifactsList"; Effect = "Allow"; Action = "s3:ListBucket"; Resource = "arn:aws:s3:::$bucket" },
    @{ Sid = "Services"; Effect = "Allow"; Action = @("ecs:DescribeServices","ecs:UpdateService")
       Resource = @("arn:aws:ecs:${region}:${account}:service/nexogc-cluster/nexogc-api-svc", "arn:aws:ecs:${region}:${account}:service/nexogc-cluster/nexogc-front-svc") },
    @{ Sid = "PassRoles"; Effect = "Allow"; Action = "iam:PassRole"; Resource = @($execRoleArn, $taskRoleArn) }
  )
}
aws iam put-role-policy --role-name nexogc-cicd-deploy-role --policy-name nexogc-cicd-deploy --policy-document "file://$tmp\pol-deploy.json" | Out-Null
Guard "put-role-policy deploy"

# --- 4) Policy del topic SNS: permitir que EventBridge publique (fallos de pipeline / rollback ECS) ---
Write-JsonFile "$tmp\sns-policy.json" @{
  Version = "2008-10-17"
  Id = "__default_policy_ID"
  Statement = @(
    @{ Sid = "__default_statement_ID"; Effect = "Allow"; Principal = @{ AWS = "*" }
       Action = @("SNS:GetTopicAttributes","SNS:SetTopicAttributes","SNS:AddPermission","SNS:RemovePermission","SNS:DeleteTopic","SNS:Subscribe","SNS:ListSubscriptionsByTopic","SNS:Publish")
       Resource = $snsArn
       Condition = @{ StringEquals = @{ "AWS:SourceOwner" = "$account" } } },
    @{ Sid = "AllowEventBridgePublish"; Effect = "Allow"; Principal = @{ Service = "events.amazonaws.com" }
       Action = "SNS:Publish"; Resource = $snsArn }
  )
}
aws sns set-topic-attributes --region $region --topic-arn $snsArn --attribute-name Policy --attribute-value "file://$tmp\sns-policy.json" | Out-Null
Guard "set-topic-attributes SNS"

Write-Host "== 16-cicd-iam OK (bucket + 4 roles + policy SNS) =="
