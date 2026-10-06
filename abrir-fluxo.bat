@echo off
REM Abre o Fluxo no navegador padrao. E so dar dois cliques.

cd /d "%~dp0"

if not exist "index.html" (
  echo Nao encontrei o arquivo index.html nesta pasta.
  echo Coloque este .bat na raiz do projeto Gerenciador-de-tarefa.
  echo.
  pause
  exit /b 1
)

echo Abrindo o Fluxo no navegador...
start "" "%~dp0index.html"
exit /b 0
