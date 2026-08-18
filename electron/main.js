const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow;
let pythonProcess = null;
let setupProcess = null;

const isDev = !app.isPackaged;
const FRONTEND_URL = isDev ? 'http://localhost:5174' : `file://${path.join(__dirname, '../frontend/dist/index.html')}`;
const BACKEND_PORT = 7654;
const SETUP_FLAG = path.join(app.getPath('userData'), 'setup_complete.flag');

// ── Check if setup has been done ──────────────────────────────────
function isSetupComplete() {
  return fs.existsSync(SETUP_FLAG);
}

function markSetupComplete() {
  fs.writeFileSync(SETUP_FLAG, new Date().toISOString());
}

// ── Check Python availability ─────────────────────────────────────
function getPythonCmd() {
  const candidates = ['python', 'python3', 'py'];
  for (const cmd of candidates) {
    try {
      const out = execSync(`${cmd} --version`, { stdio: 'pipe' }).toString();
      if (out.includes('Python 3')) return cmd;
    } catch {}
  }
  return null;
}

// ── Start Python backend ──────────────────────────────────────────
function startPythonBackend() {
  const backendPath = path.join(__dirname, '../backend/main.py');
  const pythonCmd = getPythonCmd() || 'python';
  const venvPython = os.platform() === 'win32'
    ? path.join(__dirname, '../backend/venv/Scripts/python.exe')
    : path.join(__dirname, '../backend/venv/bin/python3');

  const usePython = fs.existsSync(venvPython) ? venvPython : pythonCmd;

  pythonProcess = spawn(usePython, [backendPath, '--port', BACKEND_PORT], {
    cwd: path.join(__dirname, '../backend'),
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env }
  });

  pythonProcess.stdout.on('data', (data) => console.log('[Backend]', data.toString()));
  pythonProcess.stderr.on('data', (data) => console.error('[Backend ERR]', data.toString()));
  pythonProcess.on('close', (code) => console.log(`Python process exited: ${code}`));
}

// ── Create browser window ─────────────────────────────────────────
function createWindow(showSetup = false) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    backgroundColor: '#0a0c12',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    mainWindow.loadURL(`${FRONTEND_URL}${showSetup ? '?setup=1' : ''}`);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'), {
      query: showSetup ? { setup: '1' } : {}
    });
  }
}

// ── App lifecycle ─────────────────────────────────────────────────
app.whenReady().then(() => {
  const needsSetup = !isSetupComplete();
  createWindow(needsSetup);

  if (!needsSetup) {
    startPythonBackend();
  }
});

app.on('window-all-closed', () => {
  if (pythonProcess) pythonProcess.kill();
  if (setupProcess) setupProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC: Window controls ──────────────────────────────────────────
ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => {
  mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.handle('window-close', () => mainWindow?.close());

// ── IPC: File dialogs ─────────────────────────────────────────────
ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.filePaths[0] || null;
});
ipcMain.handle('open-file-dialog', async (e, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }]
  });
  return result.filePaths;
});
ipcMain.handle('save-file-dialog', async (e, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, { defaultPath: defaultName || 'model.hef' });
  return result.filePath;
});
ipcMain.handle('get-backend-port', () => BACKEND_PORT);
ipcMain.handle('open-external', (e, url) => shell.openExternal(url));

// ── IPC: Python check ─────────────────────────────────────────────
ipcMain.handle('check-python', () => {
  const cmd = getPythonCmd();
  if (!cmd) return { found: false };
  try {
    const ver = execSync(`${cmd} --version`, { stdio: 'pipe' }).toString().trim();
    return { found: true, version: ver, cmd };
  } catch {
    return { found: false };
  }
});

// ── IPC: Run setup ────────────────────────────────────────────────
ipcMain.handle('run-setup', async (event) => {
  return new Promise((resolve) => {
    const backendDir = path.join(__dirname, '../backend');
    const isWin = os.platform() === 'win32';
    const scriptName = isWin ? 'setup.bat' : 'setup.sh';
    const scriptPath = path.join(__dirname, '..', scriptName);

    const proc = isWin
      ? spawn('cmd.exe', ['/c', scriptPath], { cwd: backendDir, shell: false })
      : spawn('bash', [scriptPath], { cwd: backendDir });

    setupProcess = proc;

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      mainWindow?.webContents.send('setup-log', text);
    });
    proc.stderr.on('data', (data) => {
      const text = data.toString();
      mainWindow?.webContents.send('setup-log', '[stderr] ' + text);
    });
    proc.on('close', (code) => {
      if (code === 0) {
        markSetupComplete();
        mainWindow?.webContents.send('setup-log', '__SETUP_COMPLETE__');
        // Start backend now
        startPythonBackend();
        resolve({ success: true });
      } else {
        mainWindow?.webContents.send('setup-log', `__SETUP_FAILED__:${code}`);
        resolve({ success: false, code });
      }
    });
  });
});
