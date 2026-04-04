@echo off
title Hands Free Telegram Bot
echo ========================================
echo   Hands Free Telegram Bot (Gateway)
echo   Telegram User -> Hands Free AI
echo ========================================
echo.

:: Always switch to script directory (apps\web)
cd /d "%~dp0"

:: Include Portable Node.js Runtime
:: %~dp0 = apps\web\  ->  ..\..\ = HandsFreeApp Root
set "HANDSFREE_ROOT=%~dp0..\.."
set "NODE_RUNTIME=%HANDSFREE_ROOT%\.handsfree-runtime\node-v20.11.1-win-x64"

if exist "%NODE_RUNTIME%\node.exe" (
    set "PATH=%NODE_RUNTIME%;%PATH%"
    echo [Bot] Portable Node.js Runtime found.
) else (
    echo [Bot] No portable runtime found, trying System-Node...
)

:: Check if Node is available
node -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found!
    echo         Please reinstall Hands Free or contact support.
    pause
    exit /b 1
)

:: Check if telegram-bot.js exists
if not exist "telegram-bot.js" (
    echo [ERROR] telegram-bot.js not found in: %~dp0
    pause
    exit /b 1
)

echo [Bot] Starting with Node.js...
node -v
echo.

node telegram-bot.js

echo.
echo [Bot] Stopped.
pause
