@echo off
echo ============================================
echo   Instalacao do Qwen AE Companion
echo ============================================
echo.

REM Definir caminhos
set SOURCE_DIR=%~dp0
set DEST_DIR="D:\Program Files\Adobe After Effects 2026\Support Files\CEP\extensions\qwen-ae-companion"
set DEBUG_DIR=%APPDATA%\Adobe\CEP\extensions

echo [1/4] Criando diretorio de destino...
if not exist %DEST_DIR% mkdir %DEST_DIR%

echo [2/4] Copiando pasta CSXS...
xcopy /E /I /Y "%SOURCE_DIR%CSXS" "%DEST_DIR%\CSXS"
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Falha ao copiar CSXS. Verifique se os arquivos existem.
    pause
    exit /b 1
)

echo [3/4] Copiando pasta client...
xcopy /E /I /Y "%SOURCE_DIR%client" "%DEST_DIR%\client"
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Falha ao copiar client. Verifique se os arquivos existem.
    pause
    exit /b 1
)

echo [4/4] Criando arquivo .debug para habilitar modo desenvolvedor...
if not exist "%DEBUG_DIR%" mkdir "%DEBUG_DIR%"
echo [LocalHostTypes] > "%DEBUG_DIR%\.debug"
echo PSHost >> "%DEBUG_DIR%\.debug"

echo.
echo ============================================
echo   Instalacao CONCLUIDA com sucesso!
echo ============================================
echo.
echo Proximos passos:
echo 1. Reinicie o Adobe After Effects
echo 2. Vá em Janela ^> Extensões ^> Qwen AE Companion
echo 3. Insira sua API Key do Qwen (DashScope)
echo.
pause
