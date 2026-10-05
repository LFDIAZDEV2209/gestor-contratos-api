# nexogc - CloudWatch: SNS topic de alarmas + billing alarm + alarmas basicas.
$ErrorActionPreference = "Continue"
$region = "us-east-1"

# --- SNS topic ---
$topic = aws sns create-topic --region $region --name nexogc-alarms --query "TopicArn" --output text
Write-Host "SNS topic: $topic"

# --- Billing alarm ($60/mo): alarm namespace AWS/Billing solo existe en us-east-1 ---
$exists = aws cloudwatch describe-alarms --region $region --alarm-names nexogc-billing-60usd --query "MetricAlarms[0].AlarmName" --output text
if ($exists -and $exists -ne "None") { Write-Host "Billing alarm ya existe" }
else {
  aws cloudwatch put-metric-alarm --region $region `
    --alarm-name nexogc-billing-60usd `
    --alarm-description "Costo AWS estimado supera 60 USD (proyecto nexo-gestor-contratos)" `
    --namespace AWS/Billing --metric-name EstimatedCharges --dimensions "Name=Currency,Value=USD" `
    --stat Maximum --period 43200 --evaluation-periods 1 --threshold 60 --comparison-operator GreaterThanThreshold `
    --treat-missing-data missing --alarm-actions $topic --output text | Out-Null
  Write-Host "Billing alarm creada (60 USD)"
}

# --- Alarmas basicas (se activan cuando existan los recursos; creacion idempotente) ---
$exists = aws cloudwatch describe-alarms --region $region --alarm-names nexogc-api-5xx --query "MetricAlarms[0].AlarmName" --output text
if (-not $exists -or $exists -eq "None") {
  aws cloudwatch put-metric-alarm --region $region `
    --alarm-name nexogc-api-5xx `
    --alarm-description "API con errores 5xx en el ALB" `
    --namespace AWS/ApplicationELB --metric-name HTTPCode_Target_5XX_Count `
    --stat Sum --period 300 --evaluation-periods 3 --threshold 10 --comparison-operator GreaterThanThreshold `
    --treat-missing-data notBreaching --alarm-actions $topic --output text | Out-Null
  Write-Host "Alarma API 5xx creada"
}

$exists = aws cloudwatch describe-alarms --region $region --alarm-names nexogc-rds-high-cpu --query "MetricAlarms[0].AlarmName" --output text
if (-not $exists -or $exists -eq "None") {
  aws cloudwatch put-metric-alarm --region $region `
    --alarm-name nexogc-rds-high-cpu `
    --alarm-description "RDS CPU sobre 85 por ciento" `
    --namespace AWS/RDS --metric-name CPUUtilization --dimensions "Name=DBInstanceIdentifier,Value=nexogc-db-prod" `
    --stat Average --period 300 --evaluation-periods 3 --threshold 85 --comparison-operator GreaterThanThreshold `
    --treat-missing-data missing --alarm-actions $topic --output text | Out-Null
  Write-Host "Alarma RDS CPU creada"
}

$exists = aws cloudwatch describe-alarms --region $region --alarm-names nexogc-valkey-high-cpu --query "MetricAlarms[0].AlarmName" --output text
if (-not $exists -or $exists -eq "None") {
  aws cloudwatch put-metric-alarm --region $region `
    --alarm-name nexogc-valkey-high-cpu `
    --alarm-description "Valkey CPU sobre 85 por ciento" `
    --namespace AWS/ElastiCache --metric-name CPUUtilization --dimensions "Name=ReplicationGroupId,Value=nexogc-valkey-prod" `
    --stat Average --period 300 --evaluation-periods 3 --threshold 85 --comparison-operator GreaterThanThreshold `
    --treat-missing-data missing --alarm-actions $topic --output text | Out-Null
  Write-Host "Alarma Valkey CPU creada"
}

Write-Host "== Alarmas OK (SNS: $topic - suscribe tu email manualmente o pasa el email para suscribir) =="
