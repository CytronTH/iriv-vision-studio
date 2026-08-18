# IRIV Model Studio

All-in-one GUI tool for training and deploying custom AI models to IRIV Vision Studio.

## Architecture
- **Frontend**: React (Vite) + Electron
- **Backend**: Python FastAPI (runs locally on your PC)
- **Training**: Ultralytics YOLOv8 with CUDA
- **Compilation**: Handled remotely on the IRIV device (has Hailo SDK)

## Workflow
1. **Dataset** — Import Roboflow ZIP (YOLOv8 format)
2. **Train** — YOLOv8 training with CUDA on your Windows PC
3. **Export** — Convert best.pt → ONNX
4. **Compile** — Send ONNX to IRIV device → compiled to .hef automatically
5. **Deploy** — Model registered in IRIV Vision Studio, ready to use

## Setup (Windows PC)

### Prerequisites
- Python 3.10+
- Node.js 18+
- NVIDIA GPU with CUDA drivers
- Git

### Install
```bash
# Install Python deps
cd backend
pip install -r requirements.txt
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# Install Node deps
cd ..
npm install
cd frontend
npm install
```

### Run in dev mode
```bash
# In project root
npm run dev:frontend   # Terminal 1
npm run dev:backend    # Terminal 2
# Or run both with: npm run dev (requires electron)
```

### Open browser (without Electron)
```
http://localhost:5174
```

## IRIV Device Requirements
The IRIV device must have:
- IRIV Vision Studio running (port 8000)
- Hailo Dataflow Compiler (`hailo_sdk_client`) installed

The compilation API endpoint is automatically available at:
`http://<device-ip>:8000/api/compile-onnx`
