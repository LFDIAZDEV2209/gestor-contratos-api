# nexogc - Alias records: api.sevensave.com.co -> ALB (www/admin se agregan con el front).
$ErrorActionPreference = "Stop"
$zoneId = "Z0174632VIDL0S5ZYCM3"
$albDns = "nexogc-alb-prod-651088037.us-east-1.elb.amazonaws.com"
$albZid = (aws elbv2 describe-load-balancers --region us-east-1 --names nexogc-alb-prod --query "LoadBalancers[0].CanonicalHostedZoneId" --output text)

$batch = '{"Changes":[{"Action":"UPSERT","ResourceRecordSet":{"Name":"api.sevensave.com.co","Type":"A","AliasTarget":{"HostedZoneId":"' + $albZid + '","DNSName":"' + $albDns + '","EvaluateTargetHealth":true}}}]}'
$batchFile = "$env:TEMP\nexogc-alias-api.json"
[System.IO.File]::WriteAllText($batchFile, $batch)
aws route53 change-resource-record-sets --hosted-zone-id $zoneId --change-batch "file://$batchFile" --query "ChangeInfo.Status" --output text
Write-Host "Alias api.sevensave.com.co -> ALB creado"
