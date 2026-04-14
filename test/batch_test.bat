@echo off
REM TODO: Aggiornare la directory di build
echo Avvio script

set TODO=false
REM FIXME: Fallisce se il path ha spazi
if "%TODO%"=="true" echo "falso positivo"

REM NOTE: Questo script cancella tutto
del /Q /S temp\*
