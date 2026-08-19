@echo off
setlocal enabledelayedexpansion
echo.
echo ================================================
echo   IRIV Model Studio - Installing Dependencies
echo ================================================
echo.

:: Use paths passed from Electron
if "%VENV_DIR%"=="" set "VENV_DIR=%~dp0venv"
if "%BACKEND_DIR%"=="" set "BACKEND_DIR=%~dp0"

:: detect_cuda.py lives next to setup.bat (both in extraResources)
set "DETECT_CUDA=%~dp0detect_cuda.py"

echo Backend dir: %BACKEND_DIR%
echo Venv dir:    %VENV_DIR%
echo.

:: ── Step 1: Check Python ──────────────────────────────────────────
echo [1/5] Checking Python...
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
echo [2/5] Creating virtual environment...
%PYTHON_CMD% -m venv "%VENV_DIR%"
if errorlevel 1 (
    echo __SETUP_FAILED__: Failed to create venv
    exit /b 1
)
echo [OK] Virtual Environment created
echo.

:: ── Step 3: Activate and install base packages ───────────────────
echo [3/5] Installing base packages...
call "%VENV_DIR%\Scripts\activate.bat"

python -m pip install --upgrade pip --quiet
python -m pip install fastapi uvicorn python-multipart aiofiles requests --quiet
echo [OK] FastAPI installed

python -m pip install ultralytics --quiet
echo [OK] Ultralytics (YOLOv8) installed

python -m pip install onnx onnxruntime --quiet
echo [OK] ONNX installed
echo.

:: ── Step 4: Detect CUDA (call bundled detect_cuda.py) ────────────
echo [4/5] Detecting GPU and CUDA version...

set CUDA_TAG=cpu
if exist "%DETECT_CUDA%" (
    python "%DETECT_CUDA%" > "%TEMP%\iriv_cuda_tag.txt" 2>nul
    if exist "%TEMP%\iriv_cuda_tag.txt" (
        set /p CUDA_TAG=<"%TEMP%\iriv_cuda_tag.txt"
        del "%TEMP%\iriv_cuda_tag.txt" >nul 2>&1
    )
) else (
    echo [WARN] detect_cuda.py not found at %DETECT_CUDA%, defaulting to CPU
)

for /f "tokens=* delims= " %%a in ("!CUDA_TAG!") do set CUDA_TAG=%%a
echo Detected CUDA tag: !CUDA_TAG!

if "!CUDA_TAG!"=="cpu" (
    echo [GPU] No NVIDIA GPU detected - installing CPU-only PyTorch
    python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu --quiet
    echo [OK] PyTorch CPU installed
) else (
    echo [GPU] Installing PyTorch with CUDA support: !CUDA_TAG!
    python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/!CUDA_TAG! --quiet
    echo [OK] PyTorch !CUDA_TAG! installed
)
echo.

:: ── Step 5: Verify ────────────────────────────────────────────────
echo [5/5] Verifying installation...
python -c "import torch; c=torch.cuda.is_available(); g=torch.cuda.get_device_name(0) if c else 'N/A'; print('[CUDA]', c, '| GPU:', g, '| Torch:', torch.__version__)"
if errorlevel 1 (
    echo [WARN] Verification failed
) else (
    echo [OK] Verification complete
)

echo.
echo ================================================
echo   Installation complete!
echo ================================================
exit /b 0
