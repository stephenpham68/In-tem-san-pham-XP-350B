$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $projectPath
if (-not (Test-Path -LiteralPath "$projectPath\dist\index.html")) {
  npm run build
}
Start-Process "http://127.0.0.1:9638"
python "$projectPath\agent\server.py"
