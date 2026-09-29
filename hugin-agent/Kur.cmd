@echo off
cd /d "%~dp0"
echo Yazarkasa ajani kuruluyor...
"HizliSatis.AgentLauncher.exe" install
if errorlevel 1 (
  echo Kurulum olmadi.
  pause
  exit /b 1
)
echo Tamam. Bu pencereyi kapatip sitede sayfayi yenileyin.
timeout /t 4 >nul
