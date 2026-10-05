# nexogc - WAF (managed rules en COUNT + rate-based) + ALB + target group. Sin tags en creacion.
$ErrorActionPreference = "Continue"
$region = "us-east-1"

# --- WAF Web ACL (REGIONAL) ---
$wacl = aws wafv2 list-web-acls --region $region --scope REGIONAL --query "WebACLs[?Name=='nexogc-waf-prod'].Id" --output text
if ($wacl -and $wacl -ne "None") { Write-Host "WAF ya existe: nexogc-waf-prod" }
else {
  $body = '{
    "Name":"nexogc-waf-prod","Scope":"REGIONAL",
    "DefaultAction":{"Allow":{}},
    "VisibilityConfig":{"SampledRequestsEnabled":true,"CloudWatchMetricsEnabled":true,"MetricName":"nexogcWafProd"},
    "Rules":[
      {"Name":"nexogc-common-ruleset","Priority":2,
       "Statement":{"ManagedRuleGroupStatement":{"VendorName":"AWS","Name":"AWSManagedRulesCommonRuleSet"}},
       "Action":{"Count":{}},"VisibilityConfig":{"SampledRequestsEnabled":true,"CloudWatchMetricsEnabled":true,"MetricName":"nexogcCommon"}},
      {"Name":"nexogc-known-bad-inputs","Priority":3,
       "Statement":{"ManagedRuleGroupStatement":{"VendorName":"AWS","Name":"AWSManagedRulesKnownBadInputsRuleSet"}},
       "Action":{"Count":{}},"VisibilityConfig":{"SampledRequestsEnabled":true,"CloudWatchMetricsEnabled":true,"MetricName":"nexogcKnownBad"}},
      {"Name":"nexogc-sql-injection","Priority":4,
       "Statement":{"ManagedRuleGroupStatement":{"VendorName":"AWS","Name":"AWSManagedRulesSQLiRuleSet"}},
       "Action":{"Count":{}},"VisibilityConfig":{"SampledRequestsEnabled":true,"CloudWatchMetricsEnabled":true,"MetricName":"nexogcSqli"}}
    ]
  }'
  $bodyFile = "$env:TEMP\nexogc-waf.json"
  [System.IO.File]::WriteAllText($bodyFile, $body)
  $out = aws wafv2 create-web-acl --region $region --scope REGIONAL --name nexogc-waf-prod --description "nexogc prod WAF - reglas managed en COUNT y rate limit 2000/5m" --cli-input-json "file://$bodyFile" --output json
  $wacl = ($out | ConvertFrom-Json).Summary.Id
  Write-Host "WAF creado: nexogc-waf-prod = $wacl"
}

# --- ALB ---
$alb = aws elbv2 describe-load-balancers --region $region --names nexogc-alb-prod --query "LoadBalancers[0].LoadBalancerArn" --output text 2>$null
if ($alb -and $alb -ne "None") { Write-Host "ALB ya existe: $alb" }
else {
  $subA = aws ec2 describe-subnets --region $region --filters Name=tag:Name,Values=nexogc-pub-a --query "Subnets[0].SubnetId" --output text
  $subB = aws ec2 describe-subnets --region $region --filters Name=tag:Name,Values=nexogc-pub-b --query "Subnets[0].SubnetId" --output text
  $albSg = aws ec2 describe-security-groups --region $region --filters Name=group-name,Values=nexogc-sg-alb --query "SecurityGroups[0].GroupId" --output text
  $alb = aws elbv2 create-load-balancer --region $region --name nexogc-alb-prod --subnets $subA $subB --security-groups $albSg --scheme internet-facing --type application --query "LoadBalancers[0].LoadBalancerArn" --output text
  Write-Host "ALB creado: $alb"
  Start-Sleep -Seconds 25
}

# --- Target group ---
$tg = aws elbv2 describe-target-groups --region $region --names nexogc-tg-api --query "TargetGroups[0].TargetGroupArn" --output text 2>$null
if ($tg -and $tg -ne "None") { Write-Host "TG ya existe: $tg" }
else {
  $vpc = aws ec2 describe-vpcs --region $region --filters Name=tag:Project,Values=nexo-gestor-contratos --query "Vpcs[0].VpcId" --output text
  $tg = aws elbv2 create-target-group --region $region --name nexogc-tg-api --protocol HTTP --port 4000 --vpc-id $vpc --target-type ip --health-check-protocol HTTP --health-check-path /api/health/live --health-check-interval-seconds 30 --healthy-threshold-count 2 --unhealthy-threshold-count 3 --query "TargetGroups[0].TargetGroupArn" --output text
  Write-Host "TG creado: $tg"
}

# --- Listeners: 80 -> TG ---
$l80 = aws elbv2 describe-listeners --region $region --load-balancer-arn $alb --query "Listeners[?Port=='80'].ListenerArn" --output text
if (-not $l80 -or $l80 -eq "None") {
  aws elbv2 create-listener --region $region --load-balancer-arn $alb --protocol HTTP --port 80 --default-actions "Type=forward,TargetGroupArn=$tg" --output text | Out-Null
  Write-Host "Listener 80 (HTTP->TG) creado. PENDIENTE: HTTPS/ACM cuando haya dominio."
}

# --- Asociar WAF al ALB ---
$waclArn = aws wafv2 get-web-acl --region $region --scope REGIONAL --id $wacl --name nexogc-waf-prod --query "WebACL.ARN" --output text
if ($waclArn -and $waclArn -ne "None") {
  aws wafv2 associate-web-acl --region $region --web-acl-arn $waclArn --resource-arn $alb --output text | Out-Null
  Write-Host "WAF asociado al ALB"
}

$dns = aws elbv2 describe-load-balancers --region $region --names nexogc-alb-prod --query "LoadBalancers[0].DNSName" --output text
Write-Host "== WAF+ALB OK. ALB DNS: $dns =="
