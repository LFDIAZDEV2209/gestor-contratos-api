# nexogc - Certificado ACM wildcard (*.sevensave.com.co + apex) con validacion DNS automatica en Route 53.
$ErrorActionPreference = "Stop"
$region = "us-east-1"
$zoneId = "Z0174632VIDL0S5ZYCM3"
$tmp = "$env:TEMP\nexogc-acm"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

# --- Certificado ---
$arn = aws acm request-certificate --region $region `
  --domain-name sevensave.com.co `
  --subject-alternative-names "*.sevensave.com.co" `
  --validation-method DNS `
  --key-algorithm RSA_2048 `
  --idempotency-token "nexogc_2026_10_05" `
  --query "CertificateArn" --output text
Write-Host "Certificado solicitado: $arn"

Start-Sleep -Seconds 15
$cert = aws acm describe-certificate --region $region --certificate-arn $arn --output json | ConvertFrom-Json
$vOpts = $cert.Certificate.DomainValidationOptions

# --- Crear records de validacion en la hosted zone (JSON manual + de-dup: apex/wildcard comparten CNAME) ---
$recs = ""
$seen = @{}
foreach ($o in $vOpts) {
  $name = $o.ResourceRecord.Name.TrimEnd('.')
  if ($seen.ContainsKey($name)) { continue }
  $seen[$name] = $true
  $val = $o.ResourceRecord.Value
  $rec = '{"Action":"UPSERT","ResourceRecordSet":{"Name":"' + $name + '","Type":"CNAME","TTL":300,"ResourceRecords":[{"Value":"' + $val + '"}]}}'
  if ($recs -ne "") { $recs += "," }
  $recs += $rec
}
$batch = '{"Changes":[' + $recs + ']}'
$batchFile = "$tmp\validation-records.json"
[System.IO.File]::WriteAllText($batchFile, $batch, (New-Object System.Text.UTF8Encoding $false))
aws route53 change-resource-record-sets --hosted-zone-id $zoneId --change-batch "file://$batchFile" --query "ChangeInfo.Status" --output text | Out-Null
Write-Host "Records de validacion creados (auto-validara al delegar nameservers)"

Write-Host "== ACM OK: $arn =="
