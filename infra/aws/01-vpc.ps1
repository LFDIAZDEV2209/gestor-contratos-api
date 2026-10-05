# nexogc - VPC prod (us-east-1, 2 AZs): DMZ publica (ALB/NAT), app privada, data aislada.
# Idempotente: verifica existencia antes de crear. Notacion compacta AWS CLI v2 (sin espacios).
$ErrorActionPreference = "Continue"
$region = "us-east-1"
$T = 'Key=Project,Value=nexo-gestor-contratos,Key=Env,Value=prod,Key=ManagedBy,Value=aws-cli'

function Get-VpcId {
  aws ec2 describe-vpcs --region $region --filters Name=tag:Project,Values=nexo-gestor-contratos --query "Vpcs[0].VpcId" --output text
}

# --- VPC ---
$vpc = Get-VpcId
if ($vpc -and $vpc -ne "None") {
  Write-Host "VPC ya existe: $vpc"
} else {
  $vpc = aws ec2 create-vpc --region $region --cidr-block '10.40.0.0/16' --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=nexogc-vpc-prod},{Key=Project,Value=nexo-gestor-contratos},{Key=Env,Value=prod}]" --query "Vpc.VpcId" --output text
  aws ec2 modify-vpc-attribute --region $region --vpc-id $vpc --enable-dns-hostnames --output text | Out-Null
  aws ec2 modify-vpc-attribute --region $region --vpc-id $vpc --enable-dns-support --output text | Out-Null
  Write-Host "VPC creada: $vpc"
}

# --- IGW ---
$igw = aws ec2 describe-internet-gateways --region $region --filters Name=tag:Project,Values=nexo-gestor-contratos --query "InternetGateways[0].InternetGatewayId" --output text
if ($igw -and $igw -ne "None") { Write-Host "IGW ya existe: $igw" }
else {
  $igw = aws ec2 create-internet-gateway --region $region --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=nexogc-igw},{Key=Project,Value=nexo-gestor-contratos}]" --query "InternetGateway.InternetGatewayId" --output text
  aws ec2 attach-internet-gateway --region $region --internet-gateway-id $igw --vpc-id $vpc --output text | Out-Null
  Write-Host "IGW creada y atachada: $igw"
}

# --- Subnets ---
$subs = @(
  @{ n = 'nexogc-pub-a';  c = '10.40.0.0/20';  az = 'us-east-1a'; t = 'public' },
  @{ n = 'nexogc-pub-b';  c = '10.40.16.0/20'; az = 'us-east-1b'; t = 'public' },
  @{ n = 'nexogc-app-a';  c = '10.40.32.0/20'; az = 'us-east-1a'; t = 'app' },
  @{ n = 'nexogc-app-b';  c = '10.40.48.0/20'; az = 'us-east-1b'; t = 'app' },
  @{ n = 'nexogc-data-a'; c = '10.40.64.0/22'; az = 'us-east-1a'; t = 'data' },
  @{ n = 'nexogc-data-b'; c = '10.40.68.0/22'; az = 'us-east-1b'; t = 'data' }
)
foreach ($s in $subs) {
  $sid = aws ec2 describe-subnets --region $region --filters Name=tag:Name,Values=$($s.n) --query "Subnets[0].SubnetId" --output text
  if ($sid -and $sid -ne "None") { Write-Host "Subnet ya existe: $($s.n) = $sid" }
  else {
    $sid = aws ec2 create-subnet --region $region --vpc-id $vpc --cidr-block $s.c --availability-zone $s.az --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$($s.n)},{Key=Project,Value=nexo-gestor-contratos},{Key=Layer,Value=$($s.t)}]" --query "Subnet.SubnetId" --output text
    Write-Host "Subnet creada: $($s.n) = $sid"
  }
  if ($s.t -ne 'public') { aws ec2 modify-subnet-attribute --region $region --subnet-id $sid --no-map-public-ip-on-launch --output text | Out-Null }
}

# --- Route tables ---
$rtPub = aws ec2 describe-route-tables --region $region --filters Name=tag:Name,Values=nexogc-rt-public --query "RouteTables[0].RouteTableId" --output text
if (-not $rtPub -or $rtPub -eq "None") {
  $rtPub = aws ec2 create-route-table --region $region --vpc-id $vpc --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=nexogc-rt-public},{Key=Project,Value=nexo-gestor-contratos}]" --query "RouteTable.RouteTableId" --output text
  aws ec2 create-route --region $region --route-table-id $rtPub --destination-cidr-block '0.0.0.0/0' --gateway-id $igw --output text | Out-Null
  Write-Host "RT publica creada: $rtPub"
}
$rtApp = aws ec2 describe-route-tables --region $region --filters Name=tag:Name,Values=nexogc-rt-app --query "RouteTables[0].RouteTableId" --output text
if (-not $rtApp -or $rtApp -eq "None") {
  $rtApp = aws ec2 create-route-table --region $region --vpc-id $vpc --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=nexogc-rt-app},{Key=Project,Value=nexo-gestor-contratos}]" --query "RouteTable.RouteTableId" --output text
  Write-Host "RT app creada: $rtApp"
}
$rtData = aws ec2 describe-route-tables --region $region --filters Name=tag:Name,Values=nexogc-rt-data --query "RouteTables[0].RouteTableId" --output text
if (-not $rtData -or $rtData -eq "None") {
  $rtData = aws ec2 create-route-table --region $region --vpc-id $vpc --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=nexogc-rt-data},{Key=Project,Value=nexo-gestor-contratos}]" --query "RouteTable.RouteTableId" --output text
  Write-Host "RT data creada (sin ruta a Internet): $rtData"
}

foreach ($s in @('nexogc-pub-a','nexogc-pub-b')) { $sid = aws ec2 describe-subnets --region $region --filters Name=tag:Name,Values=$s --query "Subnets[0].SubnetId" --output text; aws ec2 associate-route-table --region $region --route-table-id $rtPub --subnet-id $sid --output text | Out-Null }
foreach ($s in @('nexogc-app-a','nexogc-app-b')) { $sid = aws ec2 describe-subnets --region $region --filters Name=tag:Name,Values=$s --query "Subnets[0].SubnetId" --output text; aws ec2 associate-route-table --region $region --route-table-id $rtApp --subnet-id $sid --output text | Out-Null }
foreach ($s in @('nexogc-data-a','nexogc-data-b')) { $sid = aws ec2 describe-subnets --region $region --filters Name=tag:Name,Values=$s --query "Subnets[0].SubnetId" --output text; aws ec2 associate-route-table --region $region --route-table-id $rtData --subnet-id $sid --output text | Out-Null }

# --- NAT Gateway (1 AZ por ahora; escalar a 2 si se requiere HA de egress) ---
$nat = aws ec2 describe-nat-gateways --region $region --filter Name=tag:Name,Values=nexogc-nat-a Name=state,Values=available --query "NatGateways[0].NatGatewayId" --output text
if ($nat -and $nat -ne "None") { Write-Host "NAT ya existe: $nat" }
else {
  $eip = aws ec2 allocate-address --region $region --domain vpc --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=nexogc-nat-eip},{Key=Project,Value=nexo-gestor-contratos}]" --query "AllocationId" --output text
  $pubA = aws ec2 describe-subnets --region $region --filters Name=tag:Name,Values=nexogc-pub-a --query "Subnets[0].SubnetId" --output text
  $nat = aws ec2 create-nat-gateway --region $region --subnet-id $pubA --allocation-id $eip --tag-specifications "ResourceType=nat-gateway,Tags=[{Key=Name,Value=nexogc-nat-a},{Key=Project,Value=nexo-gestor-contratos}]" --query "NatGateway.NatGatewayId" --output text
  Write-Host "NAT creada: $nat (queda pending, no bloqueamos)"
}
# Ruta app -> NAT (idempotente: si ya existe, falla silenciosamente y se ignora)
aws ec2 create-route --region $region --route-table-id $rtApp --destination-cidr-block '0.0.0.0/0' --nat-gateway-id $nat --output text 2>$null | Out-Null

# --- VPC Endpoint S3 (gateway, gratuito) ---
$ep = aws ec2 describe-vpc-endpoints --region $region --filters Name=tag:Name,Values=nexogc-ep-s3 --query "VpcEndpoints[0].VpcEndpointId" --output text
if ($ep -and $ep -ne "None") { Write-Host "Endpoint S3 ya existe: $ep" }
else {
  $ep = aws ec2 create-vpc-endpoint --region $region --vpc-id $vpc --service-name "com.amazonaws.$region.s3" --vpc-endpoint-type Gateway --route-table-ids $rtApp $rtData --tag-specifications "ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=nexogc-ep-s3},{Key=Project,Value=nexo-gestor-contratos}]" --query "VpcEndpoint.VpcEndpointId" --output text
  Write-Host "Endpoint S3 creado: $ep"
}

Write-Host "== VPC OK: $vpc =="
