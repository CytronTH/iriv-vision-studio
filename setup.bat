@echo off
setlocal enabledelayedexpansion
echo.
echo ================================================
echo   IRIV Model Studio - First Time Setup
echo ================================================
echo.

:: Step 1 - Check Python
echo [1/4] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo WARN: Python not found. Opening download page...
    start https://www.python.org/downloads/
    echo.
    echo Please install Python 3.10+ and run this setup again.
    echo Make sure to check "Add Python to PATH" during installation!
    echo.
    pause
    exit /b 1
)
python --version

:: Step 2 - Create virtual environment
echo.
echo [2/4] Creating Python virtual environment...
cd /d "%~dp0backend"
python -m venv venv
if errorlevel 1 (
    echo ERROR: Failed to create venv
    exit /b 1
)
echo Done!

:: Step 3 - Install Python packages
echo.
echo [3/4] Installing Python packages (this may take 5-10 minutes)...
echo       Downloading: FastAPI, Ultralytics YOLOv8, PyTorch CUDA...
echo.
call venv\Scripts\activate.bat

pip install --upgrade pip --quiet
pip install fastapi uvicorn python-multipart aiofiles requests --quiet
echo   [OK] FastAPI installed

pip install ultralytics --quiet
echo   [OK] Ultralytics (YOLOv8) installed

:: Install PyTorch with CUDA
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121 --quiet
echo   [OK] PyTorch CUDA installed

pip install onnx onnxruntime --quiet
echo   [OK] ONNX installed

:: Step 4 - Done
echo.
echo [4/4] Setup complete!
echo.
echo ================================================
echo   All dependencies installed successfully!
echo   IRIV Model Studio is ready to use.
echo ================================================
echo.
exit /b 0
