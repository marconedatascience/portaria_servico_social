# scripts\aprovar.ps1
# Script para aprovar usuários diretamente via API administrativa do Supabase
# Uso: .\scripts\aprovar.ps1 -Email "usuario@email.com" -Setor "portaria"

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$Email,

    [Parameter(Mandatory=$false, Position=1)]
    [ValidateSet("portaria", "servico_social", "fono")]
    [string]$Setor = "portaria"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$PythonExe = Join-Path $ProjectRoot "venv\Scripts\python.exe"

if (-not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}

$pyCode = @"
import os, sys
from dotenv import load_dotenv
from supabase import create_client

env_path = r'$ProjectRoot\backend\.env'
load_dotenv(env_path)

url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_KEY')

if not url or not key:
    print('ERRO: SUPABASE_URL ou SUPABASE_KEY ausentes no backend/.env', file=sys.stderr)
    sys.exit(1)

sb = create_client(url, key)
target_email = '$Email'.strip().lower()
target_sector = '$Setor'.strip().lower()

users = sb.auth.admin.list_users()
found = None
for u in users:
    if u.email and u.email.strip().lower() == target_email:
        found = u
        break

if not found:
    print(f'ERRO: Usuario {target_email} nao encontrado no Supabase.', file=sys.stderr)
    print('Certifique-se de que o usuario ja se cadastrou na tela de cadastro.', file=sys.stderr)
    sys.exit(1)

res = sb.auth.admin.update_user_by_id(found.id, {'app_metadata': {'role': target_sector}})
print(f'SUCESSO: Usuario {res.user.email} aprovado com setor: {target_sector}!')
"@

& $PythonExe -c $pyCode
