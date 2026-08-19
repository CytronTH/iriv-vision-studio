@echo off
setlocal enabledelayedexpansion
echo.
echo ================================================
echo   IRIV Model Studio - Installing Dependencies
echo ================================================
echo.

if "%VENV_DIR%"=="" set "VENV_DIR=%~dp0venv"
if "%BACKEND_DIR%"=="" set "BACKEND_DIR=%~dp0"

echo Backend dir: %BACKEND_DIR%
echo Venv dir:    %VENV_DIR%
echo.

:: ── Step 1: Check Python ──────────────────────────────────────────
echo [1/4] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    py --version >nul 2>&1
    if errorlevel 1 (
        echo __SETUP_FAILED__: Python not found
        exit /b 1
    )
    set PYTHON_CMD=py
) else (
    set PYTHON_CMD=python
)
%PYTHON_CMD% --version
echo.

:: ── Step 2: Create virtual environment ───────────────────────────
echo [2/4] Creating virtual environment...
%PYTHON_CMD% -m venv "%VENV_DIR%"
if errorlevel 1 (
    echo __SETUP_FAILED__: Failed to create venv
    exit /b 1
)
echo [OK] Virtual Environment created
echo.

:: ── Step 3: Activate and install packages ────────────────────────
echo [3/4] Installing packages...
call "%VENV_DIR%\Scripts\activate.bat"

python -m pip install --upgrade pip --quiet
python -m pip install fastapi uvicorn python-multipart aiofiles requests --quiet
echo [OK] FastAPI installed

python -m pip install ultralytics --quiet
echo [OK] Ultralytics (YOLOv8) installed

python -m pip install onnx onnxruntime --quiet
echo [OK] ONNX installed

:: Always install PyTorch CUDA 12.4
:: Works on all machines: uses GPU if available, falls back to CPU if not
:: (CUDA build = ~2.5GB but supports both GPU and CPU seamlessly)
echo Downloading PyTorch with CUDA 12.4 support...
echo (This may take 5-10 minutes depending on your connection)
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
if errorlevel 1 (
    echo [WARN] cu124 failed, falling back to CPU-only PyTorch
    python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu --quiet
    echo [OK] PyTorch CPU installed ^(fallback^)
) else (
    echo [OK] PyTorch cu124 installed
)
echo.

:: ── Step 4: Verify ────────────────────────────────────────────────
echo [4/4] Verifying installation...
python -c "import torch; c=torch.cuda.is_available(); g=torch.cuda.get_device_name(0) if c else 'N/A'; print('[Torch]', torch.__version__, '| CUDA:', c, '| GPU:', g)"
if errorlevel 1 (
    echo __SETUP_FAILED__: PyTorch import failed
    exit /b 1
)
echo [OK] Done!

echo.
echo ================================================
echo   Installation complete!
echo ================================================
exit /b 0
