# nexogc - Security Groups con encadenamiento minimo privilegio:
# DMZ(ALB) -> app(ECS) -> data(RDS/Valkey). Ningun acceso directo de Internet a datos.
$ErrorActionPreference = "Continue"
$region = "us-east-1"
$vpc = aws ec2 describe-vpcs --region $region --filters Name=tag:Project,Values=nexo-gestor-contratos --query "Vpcs[0].VpcId" --output text

function SG($name, $desc) {
  $id = aws ec2 describe-security-groups --region $region --filters Name=vpc-id,Values=$vpc Name=group-name,Values=$name --query "SecurityGroups[0].GroupId" --output text
  if ($id -and $id -ne "None") { Write-Host "SG ya existe: $name = $id"; return $id }
  $id = aws ec2 create-security-group --region $region --vpc-id $vpc --group-name $name --description $desc --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=$name},{Key=Project,Value=nexo-gestor-contratos},{Key=Env,Value=prod}]" --query "GroupId" --output text
  Write-Host "SG creado: $name = $id"
  return $id
}

$alb = SG "nexogc-sg-alb" "DMZ ALB de nexo-gestor-contratos (HTTP/HTTPS publicos)"
$app = SG "nexogc-sg-app" "Backend NestJS de nexo-gestor-contratos (4000 solo desde ALB)"
$db  = SG "nexogc-sg-db"  "RDS PostgreSQL de nexo-gestor-contratos (5432 solo desde app)"
$cache = SG "nexogc-sg-cache" "ElastiCache Valkey de nexo-gestor-contratos (6379 solo desde app)"

# ALB: 80/443 desde Internet
aws ec2 authorize-security-group-ingress --region $region --group-id $alb --protocol tcp --port 80 --cidr "0.0.0.0/0" --output text 2>$null | Out-Null
aws ec2 authorize-security-group-ingress --region $region --group-id $alb --protocol tcp --port 443 --cidr "0.0.0.0/0" --output text 2>$null | Out-Null
# ALB egress: hacia app en 4000
aws ec2 authorize-security-group-egress --region $region --group-id $alb --protocol tcp --port 4000 --source-group $app --output text 2>$null | Out-Null

# App: ingress 4000 desde ALB
aws ec2 authorize-security-group-ingress --region $region --group-id $app --protocol tcp --port 4000 --source-group $alb --output text 2>$null | Out-Null
# App egress: DB y cache (y https para pulls de ECR via NAT)
aws ec2 authorize-security-group-egress --region $region --group-id $app --protocol tcp --port 5432 --source-group $db --output text 2>$null | Out-Null
aws ec2 authorize-security-group-egress --region $region --group-id $app --protocol tcp --port 6379 --source-group $cache --output text 2>$null | Out-Null
aws ec2 authorize-security-group-egress --region $region --group-id $app --protocol tcp --port 443 --cidr "0.0.0.0/0" --output text 2>$null | Out-Null

# DB: 5432 desde app
aws ec2 authorize-security-group-ingress --region $region --group-id $db --protocol tcp --port 5432 --source-group $app --output text 2>$null | Out-Null
# Cache: 6379 desde app
aws ec2 authorize-security-group-ingress --region $region --group-id $cache --protocol tcp --port 6379 --source-group $app --output text 2>$null | Out-Null

Write-Host "== SGs OK: ALB=$alb APP=$app DB=$db CACHE=$cache =="
