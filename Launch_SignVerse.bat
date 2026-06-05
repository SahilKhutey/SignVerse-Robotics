@echo off
title SignVerse Robotics OS Launcher
cd /d "%~dp0"
echo ==========================================================
echo         SIGNVERSE ROBOTICS SYSTEM LAUNCHER
echo ==========================================================
echo.
echo Starting all systems (Python Backend, API Gateway, Dashboard)...
echo.
python start_system.py
pause
