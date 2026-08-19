# IRIV Model Studio — Agent Rules

## Git Push Policy for Installer-Related Changes

**Rule:** Before pushing any change that affects the packaged installer or requires the user to reinstall/update the app, **STOP and ask the user first** whether there are additional fixes or features to bundle in the same build.

### What counts as "installer-related":
- `setup.bat` — dependency installation script
- `install_torch.py` — PyTorch/CUDA installation
- `detect_cuda.py` — CUDA detection
- `electron/main.js` — Electron main process
- `electron/preload.js` — IPC bridge
- `electron/debug.html` — Debug console window
- `package.json` — build config / extraResources
- `backend/main.py` — FastAPI backend (Python subprocess logic)
- Any file listed under `extraResources` in `package.json`

### What to ask before pushing:
> "ฉันเตรียมการแก้ไขต่อไปนี้สำหรับ build ถัดไปแล้ว:
> - [รายการสิ่งที่แก้]
>
> มีอะไรที่อยากให้เพิ่มหรือแก้ไขพร้อมกันในรอบนี้ไหม ก่อนที่จะ push?"

### Why this matters:
Each push triggers a GitHub Actions build (~5-10 min) and requires the user to wait for auto-update.
Batching multiple fixes into a single push saves time and avoids unnecessary version increments.

### Exception:
For **frontend-only** changes (React components in `frontend/src/`), pushing immediately is acceptable since they don't require reinstall — only a quick Electron reload.
