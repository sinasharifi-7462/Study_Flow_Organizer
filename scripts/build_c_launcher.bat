@echo off
title Study Flow Organizer - Native C Launcher Builder
cd /d "%~dp0.."

echo ======================================================================
echo   Study Flow Organizer - Building Native GUI Executable (.exe)
echo ======================================================================
echo.

where gcc >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] GCC compiler was not found in your system PATH.
    echo Please install MinGW-w64 or w64devkit and add GCC to your PATH.
    echo.
    echo Alternatively, run:
    echo   npm run build:exe
    echo to build a self-contained portable executable using Node.js.
    echo.
    pause
    exit /b 1
)

echo [1/2] Compiling Windows icon resource...
where windres >nul 2>nul
if %errorlevel% equ 0 (
    windres -i scripts/app.rc -o scripts/app.res -I .
    set RES_PARAM=scripts/app.res
) else (
    echo [INFO] windres not found, compiling without embedded resource...
    set RES_PARAM=
)

echo [2/2] Compiling pure Windows GUI launcher with GCC...
gcc -mwindows -O2 scripts/launcher.c %RES_PARAM% -o Study_Flow_Organizer.exe -lws2_32

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] Study_Flow_Organizer.exe has been compiled successfully!
    echo Location: %~dp0..\Study_Flow_Organizer.exe
) else (
    echo.
    echo [ERROR] Compilation failed.
)

echo.
pause
