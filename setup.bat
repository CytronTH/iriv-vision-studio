@echo off
setlocal enabledelayedexpansion
echo.
echo ================================================
echo   IRIV Model Studio - Installing Dependencies
echo ================================================
echo.

:: Use VENV_DIR from Electron if provided
if "%VENV_DIR%"=="" set "VENV_DIR=%~dp0venv"
if "%BACKEND_DIR%"=="" set "BACKEND_DIR=%~dp0"

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

:: ── Step 3: Install base packages ────────────────────────────────
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

:: ── Step 4: Detect CUDA via Python script (no ^ line-continuation issues) ──
echo [4/5] Detecting GPU and CUDA version...

:: Use Python to WRITE the detection script, then run it
:: This avoids all bat escape/truncation issues with ^ and >
set "DETECT_PY=%TEMP%\iriv_detect_cuda.py"
set "DETECT_OUT=%TEMP%\iriv_cuda_tag.txt"

python -c "open(r'%DETECT_PY%','w').write('''
import subprocess, re, sys

def find_cuda_tag():
    candidates = [
        'nvidia-smi',
        r'C:\\Windows\\System32\\nvidia-smi.exe',
        r'C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe',
    ]
    output = ''
    for cmd in candidates:
        try:
            r = subprocess.run([cmd], capture_output=True, text=True, timeout=10)
            if r.returncode == 0:
                output = r.stdout
                break
        except Exception:
            continue

    m = re.search(r\"CUDA Version:\\s*([\\d.]+)\", output)
    if not m:
        return 'cpu'

    parts = m.group(1).split('.')
    maj = int(parts[0])
    mn  = int(parts[1]) if len(parts) > 1 else 0

    if maj > 12 or (maj == 12 and mn >= 4):
        return 'cu124'
    elif maj == 12 and mn >= 1:
        return 'cu121'
    elif maj >= 11:
        return 'cu118'
    else:
        return 'cpu'

print(find_cuda_tag())
''')"

python "%DETECT_PY%" > "%DETECT_OUT%" 2>nul

set CUDA_TAG=cpu
if exist "%DETECT_OUT%" (
    set /p CUDA_TAG=<"%DETECT_OUT%"
    del "%DETECT_OUT%" >nul 2>&1
)
if exist "%DETECT_PY%" del "%DETECT_PY%" >nul 2>&1

:: Trim any trailing whitespace/CR
for /f "tokens=* delims= " %%a in ("!CUDA_TAG!") do set CUDA_TAG=%%a

echo Detected CUDA tag: !CUDA_TAG!

if "!CUDA_TAG!"=="cpu" (
    echo [GPU] No NVIDIA GPU or unsupported driver - installing CPU PyTorch
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
python -c "import torch; c=torch.cuda.is_available(); g=torch.cuda.get_device_name(0) if c else 'N/A'; print('[CUDA]',c,'| GPU:',g,'| Torch:',torch.__version__)"
if errorlevel 1 (
    echo [WARN] Verification failed
) else (
    echo [OK] Done
)

echo.
echo ================================================
echo   Installation complete!
echo ================================================
exit /b 0
