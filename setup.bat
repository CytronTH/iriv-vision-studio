@echo off
setlocal enabledelayedexpansion
echo.
echo ================================================
echo   IRIV Model Studio - Installing Dependencies
echo ================================================
echo.

:: Use VENV_DIR from Electron if provided, else default to backend\venv
if "%VENV_DIR%"=="" (
    set "VENV_DIR=%~dp0venv"
)
if "%BACKEND_DIR%"=="" (
    set "BACKEND_DIR=%~dp0"
)

echo Backend dir: %BACKEND_DIR%
echo Venv dir:    %VENV_DIR%
echo.

:: Step 1 - Check Python
echo [1/4] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    py --version >nul 2>&1
    if errorlevel 1 (
        echo __SETUP_FAILED__: Python not found
        exit /b 1
    ) else (
        set PYTHON_CMD=py
    )
) else (
    set PYTHON_CMD=python
)
%PYTHON_CMD% --version
echo.

:: Step 2 - Create virtual environment
echo [2/4] Creating virtual environment...
%PYTHON_CMD% -m venv "%VENV_DIR%"
if errorlevel 1 (
    echo __SETUP_FAILED__: Failed to create venv
    exit /b 1
)
echo [OK] Virtual Environment created
echo.

:: Step 3 - Activate and install
echo [3/4] Installing packages...
call "%VENV_DIR%\Scripts\activate.bat"

python -m pip install --upgrade pip --quiet
python -m pip install fastapi uvicorn python-multipart aiofiles requests --quiet
echo [OK] FastAPI installed

python -m pip install ultralytics --quiet
echo [OK] Ultralytics (YOLOv8) installed

python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121 --quiet
echo [OK] PyTorch CUDA installed

python -m pip install onnx onnxruntime --quiet
echo [OK] ONNX installed

echo.
echo [4/4] Done!
echo ================================================
echo   All packages installed successfully!
echo ================================================
exit /b 0
