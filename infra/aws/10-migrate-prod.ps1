# nexogc - Migraciones contra RDS prod: task one-off con --overrides sobre nexogc-api.
$ErrorActionPreference = "Stop"
$region = "us-east-1"
$appA = aws ec2 describe-subnets --region $region --filters Name=tag:Name,Values=nexogc-app-a --query "Subnets[0].SubnetId" --output text
$appB = aws ec2 describe-subnets --region $region --filters Name=tag:Name,Values=nexogc-app-b --query "Subnets[0].SubnetId" --output text
$appSg = aws ec2 describe-security-groups --region $region --filters Name=group-name,Values=nexogc-sg-app --query "SecurityGroups[0].GroupId" --output text

$overridesFile = "$env:TEMP\nexogc-migrate-overrides.json"
[System.IO.File]::WriteAllText($overridesFile, '{"containerOverrides":[{"name":"api","command":["node","node_modules/typeorm/cli.js","migration:run","-d","dist/database/data-source.js"]}]}')

$task = aws ecs run-task --region us-east-1 --cluster nexogc-cluster --task-definition nexogc-api `
  --launch-type FARGATE `
  --network-configuration "awsvpcConfiguration={subnets=[$appA,$appB],securityGroups=[$appSg],assignPublicIp=DISABLED}" `
  --started-by "infra-migrate-script" `
  --overrides "file://$overridesFile" --query "tasks[0].taskArn" --output text
Write-Host "Task de migracion lanzada: $task"
Write-Host "Verifica con: aws ecs wait tasks-stopped --cluster nexogc-cluster --tasks $task"
