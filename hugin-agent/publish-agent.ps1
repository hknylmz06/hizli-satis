# Hugin ajanını gizlice kurar, Windows açılışında otomatik başlatır.
# Bir kez çalıştırın (PowerShell):
#   Set-ExecutionPolicy -Scope Process Bypass
#   .\publish-agent.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$installDir = Join-Path $env:LOCALAPPDATA "HizliSatisAgent"

Write-Host "Ajan publish ediliyor..."
dotnet publish (Join-Path $root "HizliSatis.HuginAgent.csproj") -c Release -o $installDir --self-contained false
dotnet publish (Join-Path $root "Launcher\HizliSatis.AgentLauncher.csproj") -c Release -o $installDir --self-contained false

$launcher = Join-Path $installDir "HizliSatis.AgentLauncher.exe"
Write-Host "Kurulum (protokol + startup)..."
& $launcher install

Write-Host ""
Write-Host "Tamam. Ajan gizli çalışıyor: http://127.0.0.1:5055"
Write-Host "Siteye giriş yapınca otomatik uyandırılır."
