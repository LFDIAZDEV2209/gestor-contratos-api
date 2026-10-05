# nexogc - Listener HTTPS 443 + reglas por hostname + redirect HTTP->HTTPS.
# REQUIERE: certificado ACM en estado ISSUED (publica el CNAME de validacion en GoDaddy primero).
$ErrorActionPreference = "Stop"
$region = "us-east-1"
$certificateArn = "arn:aws:acm:us-east-1:933629770820:certificate/4e938570-dcd3-405d-87dc-3d734e883be4"
$albArn = aws elbv2 describe-load-balancers --region $region --names nexogc-alb-prod --query "LoadBalancers[0].LoadBalancerArn" --output text
$tgApi = aws elbv2 describe-target-groups --region $region --names nexogc-tg-api --query "TargetGroups[0].TargetGroupArn" --output text
$tgFront = aws elbv2 describe-target-groups --region $region --names nexogc-tg-front --query "TargetGroups[0].TargetGroupArn" --output text

$cert = aws acm describe-certificate --region $region --certificate-arn $certificateArn --query "Certificate.Status" --output text
if ($cert -ne "ISSUED") { throw "Certificado ACM no esta ISSUED (estado: $cert). Publica el CNAME de validacion en GoDaddy y reintenta." }

# --- Listener 443 con certificado ---
$l443 = aws elbv2 describe-listeners --region $region --load-balancer-arn $albArn --query "Listeners[?Port=='443'].ListenerArn" --output text
if ($l443 -and $l443 -ne "None") {
  Write-Host "Listener 443 ya existe: $l443"
} else {
  $l443 = aws elbv2 create-listener --region $region --load-balancer-arn $albArn `
    --protocol HTTPS --port 443 --certificates "CertificateArn=$certificateArn" --ssl-policy "ELBSecurityPolicy-TLS13-1-2-2021-06" `
    --default-actions "Type=forward,TargetGroupArn=$tgApi" `
    --query "Listeners[0].ListenerArn" --output text
  Write-Host "Listener 443 creado: $l443"
}

# --- Reglas por hostname en 443 ---
$rules = aws elbv2 describe-rules --region $region --listener-arn $l443 --query "Rules[].Conditions[0].Values[0]" --output text
if (($rules -split "`t") -notcontains "api.sevensave.com.co") {
  aws elbv2 create-rule --region $region --listener-arn $l443 --priority 10 --conditions "Field=host-header,Values=api.sevensave.com.co" --actions "Type=forward,TargetGroupArn=$tgApi" --output text | Out-Null
  Write-Host "Regla 443: api.sevensave.com.co -> tg-api"
}
if (($rules -split "`t") -notcontains "admin.sevensave.com.co") {
  aws elbv2 create-rule --region $region --listener-arn $l443 --priority 20 --conditions "Field=host-header,Values=admin.sevensave.com.co" --actions "Type=forward,TargetGroupArn=$tgFront" --output text | Out-Null
  Write-Host "Regla 443: admin.sevensave.com.co -> tg-front"
}

# --- Redirect del listener 80 a HTTPS (el default forward por host se pierde al redirigir) ---
$l80 = aws elbv2 describe-listeners --region $region --load-balancer-arn $albArn --query "Listeners[?Port=='80'].ListenerArn" --output text
aws elbv2 modify-listener --region $region --listener-arn $l80 `
  --default-actions "Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,StatusCode=HTTP_301}" --output text | Out-Null
Write-Host "Listener 80: redirect 301 -> HTTPS"

Write-Host "== HTTPS OK. Verifica: https://api.sevensave.com.co/api/health/live y https://admin.sevensave.com.co =="
