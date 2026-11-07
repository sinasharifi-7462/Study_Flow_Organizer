@echo off
title Launching Study Flow Organizer...
cd /d "%~dp0"

:: 1. If native standalone executable exists in root, launch it directly
if exist "%~dp0Study_Flow_Organizer.exe" (
    start "" "%~dp0Study_Flow_Organizer.exe"
    exit /b 0
)

:: 2. If dist\Study_Flow_Organizer.exe exists, launch it
if exist "%~dp0dist\Study_Flow_Organizer.exe" (
    start "" "%~dp0dist\Study_Flow_Organizer.exe"
    exit /b 0
)

:: 3. If Node.js is installed, launch desktop app / local server
where node >nul 2>nul
if %errorlevel% equ 0 (
    if exist "%~dp0desktop\launcher.js" (
        start "" node "%~dp0desktop\launcher.js"
        exit /b 0
    )
    start /min "Study Flow Server" node "%~dp0server\server.js"
    timeout /t 1 /nobreak >nul
    start "" "http://127.0.0.1:3456"
    exit /b 0
)

:: 4. Fallback: Standalone offline browser mode
start "" "%~dp0app\index.html"
exit /b 0
