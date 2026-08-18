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
echo [1/5] Checking Python...
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
echo [2/5] Creating virtual environment...
%PYTHON_CMD% -m venv "%VENV_DIR%"
if errorlevel 1 (
    echo __SETUP_FAILED__: Failed to create venv
    exit /b 1
)
echo [OK] Virtual Environment created
echo.

:: Step 3 - Activate and install base packages
echo [3/5] Installing packages...
call "%VENV_DIR%\Scripts\activate.bat"

python -m pip install --upgrade pip --quiet
python -m pip install fastapi uvicorn python-multipart aiofiles requests --quiet
echo [OK] FastAPI installed

python -m pip install ultralytics --quiet
echo [OK] Ultralytics (YOLOv8) installed

:: Step 4 - Install PyTorch with CUDA 12.4 (compatible with CUDA driver >= 12.4)
echo [4/5] Installing PyTorch CUDA 12.4...
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124 --quiet
echo [OK] PyTorch CUDA 12.4 installed

python -m pip install onnx onnxruntime --quiet
echo [OK] ONNX installed

:: Step 5 - Verify CUDA
echo [5/5] Verifying CUDA...
python -c "import torch; cuda=torch.cuda.is_available(); gpu=torch.cuda.get_device_name(0) if cuda else 'N/A'; print('[CUDA] Available:', cuda, '| GPU:', gpu)"
if errorlevel 1 (
    echo [WARN] Could not verify CUDA - PyTorch may not be installed correctly
) else (
    echo [OK] PyTorch verification complete
)

echo.
echo [4/4] Done!
echo ================================================
echo   All packages installed successfully!
echo ================================================
exit /b 0
