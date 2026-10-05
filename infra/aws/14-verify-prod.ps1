# Read-only production verification. Does not deploy, change DNS or retrieve secrets.
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$region = 'us-east-1'
$expectedAccount = '933629770820'
$cluster = 'nexogc-cluster'
$certificateArn = "arn:aws:acm:${region}:${expectedAccount}:certificate/4e938570-dcd3-405d-87dc-3d734e883be4"
$zoneId = 'Z0174632VIDL0S5ZYCM3'

function Invoke-AwsJson {
  param([string[]]$CommandArgs)
  # Windows PowerShell can turn native stderr into a terminating exception.
  $ErrorActionPreference = 'Continue'
  $raw = & aws @CommandArgs --output json --cli-connect-timeout 5 --cli-read-timeout 10 2>&1
  $code = $LASTEXITCODE
  if ($code -ne 0) { throw "AWS failed (exit ${code}): $($raw -join [Environment]::NewLine)" }
  return ($raw -join [Environment]::NewLine) | ConvertFrom-Json
}

$identity = Invoke-AwsJson -CommandArgs @('sts', 'get-caller-identity', '--query', '{Account:Account}')
if ($identity.Account -ne $expectedAccount) {
  throw "Wrong AWS account: expected $expectedAccount, received $($identity.Account)."
}

$checks = New-Object 'System.Collections.Generic.List[object]'
function Add-Check {
  param([string]$Name, [scriptblock]$Read)
  try {
    $data = & $Read
    $checks.Add([pscustomobject]@{ Name = $Name; ReadSucceeded = $true; Data = $data })
  } catch {
    $checks.Add([pscustomobject]@{ Name = $Name; ReadSucceeded = $false; Error = $_.Exception.Message })
  }
}

Add-Check 'api_service' {
  Invoke-AwsJson -CommandArgs @('ecs', 'describe-services', '--region', $region,
    '--cluster', $cluster, '--services', 'nexogc-api-svc', '--query',
    '{Failures:failures,Services:services[].{Name:serviceName,Status:status,Desired:desiredCount,Running:runningCount,Pending:pendingCount,TaskDefinition:taskDefinition,Deployments:deployments[].{State:rolloutState,Status:status,TaskDefinition:taskDefinition},Events:events[0:5]}}')
}
Add-Check 'cluster_services_frontend_inventory' {
  Invoke-AwsJson -CommandArgs @('ecs', 'list-services', '--region', $region,
    '--cluster', $cluster, '--query', 'serviceArns')
}
Add-Check 'rds' {
  Invoke-AwsJson -CommandArgs @('rds', 'describe-db-instances', '--region', $region,
    '--db-instance-identifier', 'nexogc-db-prod', '--query',
    'DBInstances[].{Name:DBInstanceIdentifier,Status:DBInstanceStatus,Engine:Engine,Endpoint:Endpoint,PubliclyAccessible:PubliclyAccessible,Encrypted:StorageEncrypted}')
}
Add-Check 'valkey' {
  Invoke-AwsJson -CommandArgs @('elasticache', 'describe-replication-groups', '--region', $region,
    '--replication-group-id', 'nexogc-valkey-prod', '--query',
    'ReplicationGroups[].{Name:ReplicationGroupId,Status:Status,TLS:TransitEncryptionEnabled,Auth:AuthTokenEnabled,ClusterEnabled:ClusterEnabled,Nodes:NodeGroups[].{Status:Status,Primary:PrimaryEndpoint}}')
}
Add-Check 'alb_listeners' {
  $alb = Invoke-AwsJson -CommandArgs @('elbv2', 'describe-load-balancers', '--region', $region,
    '--names', 'nexogc-alb-prod', '--query', 'LoadBalancers[0].{Arn:LoadBalancerArn,DNS:DNSName}')
  if (-not $alb.Arn) { throw 'Project ALB not found.' }
  Invoke-AwsJson -CommandArgs @('elbv2', 'describe-listeners', '--region', $region,
    '--load-balancer-arn', $alb.Arn, '--query',
    'Listeners[].{Port:Port,Protocol:Protocol,Certificates:Certificates,Actions:DefaultActions}')
}
Add-Check 'api_target_health' {
  $target = Invoke-AwsJson -CommandArgs @('elbv2', 'describe-target-groups', '--region', $region,
    '--names', 'nexogc-tg-api', '--query', 'TargetGroups[0].TargetGroupArn')
  if (-not $target) { throw 'Project API target group not found.' }
  Invoke-AwsJson -CommandArgs @('elbv2', 'describe-target-health', '--region', $region,
    '--target-group-arn', $target, '--query',
    'TargetHealthDescriptions[].{Target:Target,Health:TargetHealth}')
}
Add-Check 'acm_certificate' {
  Invoke-AwsJson -CommandArgs @('acm', 'describe-certificate', '--region', $region,
    '--certificate-arn', $certificateArn, '--query',
    'Certificate.{Domain:DomainName,Status:Status,Validation:DomainValidationOptions[].{Domain:DomainName,Status:ValidationStatus,Record:ResourceRecord}}')
}
Add-Check 'dns_zone_and_records' {
  $zone = Invoke-AwsJson -CommandArgs @('route53', 'get-hosted-zone', '--id', $zoneId)
  if ($zone.HostedZone.Name -ne 'sevensave.com.co.') { throw 'Hosted zone does not match project domain.' }
  $records = Invoke-AwsJson -CommandArgs @('route53', 'list-resource-record-sets',
    '--hosted-zone-id', $zoneId, '--query',
    "ResourceRecordSets[?Type=='NS' || Type=='CNAME' || Name=='api.sevensave.com.co.']")
  [pscustomobject]@{ Name = $zone.HostedZone.Name; Delegation = $zone.DelegationSet.NameServers; Records = $records }
}
Add-Check 's3_document_bucket_public_access' {
  Invoke-AwsJson -CommandArgs @('s3api', 'get-public-access-block', '--region', $region,
    '--bucket', 'nexogc-contratos-docs-933629770820')
}

[pscustomobject]@{
  CheckedAtUtc = [DateTime]::UtcNow.ToString('o')
  Account = $expectedAccount
  Region = $region
  Note = 'ReadSucceeded means the query succeeded, not that the resource is healthy. No mutations or secret reads.'
  Checks = @($checks.ToArray())
} | ConvertTo-Json -Depth 20

if (@($checks | Where-Object { -not $_.ReadSucceeded }).Count -gt 0) { exit 1 }
