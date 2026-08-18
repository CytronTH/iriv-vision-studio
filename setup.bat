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

:: Step 3 - Activate venv and upgrade pip
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

:: Step 4 - Auto-detect CUDA and install matching PyTorch
echo [4/5] Detecting GPU and CUDA version...

:: Use Python (system, before venv activation issues) to parse nvidia-smi
%PYTHON_CMD% -c ^
"import subprocess,re,sys; r=subprocess.run(['nvidia-smi'],capture_output=True,text=True,timeout=10); m=re.search(r'CUDA Version:\s*([\d.]+)',r.stdout); v=m.group(1) if m else '0.0'; p=v.split('.'); maj=int(p[0]); mn=int(p[1]) if len(p)>1 else 0; tag=('cu124' if maj>12 or(maj==12 and mn>=4) else 'cu121' if maj==12 and mn>=1 else 'cu118' if maj>=11 else 'cpu'); print(tag)" ^
> "%TEMP%\cuda_tag.tmp" 2>nul

set CUDA_TAG=cpu
if exist "%TEMP%\cuda_tag.tmp" (
    set /p CUDA_TAG=<"%TEMP%\cuda_tag.tmp"
    del "%TEMP%\cuda_tag.tmp" 2>nul
)

:: Trim whitespace from CUDA_TAG
for /f "tokens=* delims= " %%a in ("!CUDA_TAG!") do set CUDA_TAG=%%a

echo Detected CUDA tag: !CUDA_TAG!

if "!CUDA_TAG!"=="cpu" (
    echo [GPU] No NVIDIA GPU or unsupported CUDA - installing CPU-only PyTorch
    python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu --quiet
    echo [OK] PyTorch CPU installed
) else (
    echo [GPU] Installing PyTorch with CUDA support: !CUDA_TAG!
    python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/!CUDA_TAG! --quiet
    echo [OK] PyTorch !CUDA_TAG! installed
)
echo.

:: Step 5 - Verify installation
echo [5/5] Verifying installation...
python -c ^
"import torch; cuda=torch.cuda.is_available(); gpu=torch.cuda.get_device_name(0) if cuda else 'N/A'; ver=torch.__version__; print('[CUDA] Available:',cuda,'| GPU:',gpu,'| Torch:',ver)"
if errorlevel 1 (
    echo [WARN] Could not verify PyTorch - check installation manually
) else (
    echo [OK] PyTorch verification complete
)

echo.
echo ================================================
echo   Installation complete!
echo ================================================
exit /b 0
