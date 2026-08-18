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

// ── IPC: Auto-install Python ──────────────────────────────────────
ipcMain.handle('install-python', async () => {
  return new Promise((resolve) => {
    const isWin = os.platform() === 'win32';
    if (!isWin) {
      // On Linux: use apt
      mainWindow?.webContents.send('python-install-log', 'Running: sudo apt install python3...');
      const proc = spawn('bash', ['-c', 'sudo apt-get install -y python3 python3-pip python3-venv']);
      proc.stdout.on('data', d => mainWindow?.webContents.send('python-install-log', d.toString()));
      proc.stderr.on('data', d => mainWindow?.webContents.send('python-install-log', d.toString()));
      proc.on('close', code => resolve({ success: code === 0 }));
      return;
    }

    // Windows: try winget first, then fall back to silent .exe install
    const PYTHON_VERSION = '3.12.5';
    const PYTHON_URL = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-amd64.exe`;
    const installerPath = path.join(os.tmpdir(), `python_installer.exe`);

    const sendLog = (msg) => mainWindow?.webContents.send('python-install-log', msg);

    // Try winget first (built-in on modern Windows 10/11)
    sendLog('Checking for winget (Windows Package Manager)...');
    let wingetAvailable = false;
    try {
      execSync('winget --version', { stdio: 'pipe' });
      wingetAvailable = true;
    } catch {}

    if (wingetAvailable) {
      sendLog('✅ winget found! Installing Python 3.12 via winget...');
      const proc = spawn('winget', [
        'install', 'Python.Python.3.12',
        '--silent',
        '--accept-source-agreements',
        '--accept-package-agreements',
        '--scope', 'user'
      ], { shell: true });

      proc.stdout.on('data', d => sendLog(d.toString()));
      proc.stderr.on('data', d => sendLog(d.toString()));
      proc.on('close', (code) => {
        if (code === 0) {
          sendLog('__PYTHON_INSTALLED__');
          resolve({ success: true, method: 'winget' });
        } else {
          sendLog('winget failed, falling back to direct download...');
          installViaDirect(installerPath, PYTHON_URL, sendLog, resolve);
        }
      });
    } else {
      sendLog('winget not available. Downloading Python installer directly...');
      installViaDirect(installerPath, PYTHON_URL, sendLog, resolve);
    }
  });
});

function installViaDirect(installerPath, url, sendLog, resolve) {
  const PYTHON_VERSION = '3.12.5';
  sendLog(`Downloading Python ${PYTHON_VERSION} from python.org...`);
  sendLog('(This may take 1-2 minutes depending on your internet speed)');

  // Use PowerShell to download
  const downloadCmd = `(New-Object Net.WebClient).DownloadFile('${url}', '${installerPath}')`;
  const dlProc = spawn('powershell', [
    '-NoProfile', '-NonInteractive', '-Command', downloadCmd
  ], { shell: false });

  dlProc.stderr.on('data', d => sendLog(d.toString()));
  dlProc.on('close', (dlCode) => {
    if (dlCode !== 0) {
      sendLog('__PYTHON_FAILED__: Download error');
      resolve({ success: false, reason: 'download_failed' });
      return;
    }
    sendLog('Download complete. Running silent installer...');
    sendLog('(Installing Python for current user, adding to PATH)');

    // Silent install: user-only, prepend to PATH, no test suite
    const installProc = spawn(installerPath, [
      '/quiet',
      'InstallAllUsers=0',
      'PrependPath=1',
      'Include_test=0',
      'Include_doc=0',
      'Include_launcher=1',
      'SimpleInstall=1'
    ], { shell: false });

    installProc.on('close', (code) => {
      // Cleanup installer
      try { fs.unlinkSync(installerPath); } catch {}

      if (code === 0) {
        sendLog('__PYTHON_INSTALLED__');
        resolve({ success: true, method: 'direct' });
      } else {
        sendLog(`__PYTHON_FAILED__: Installer exited with code ${code}`);
        resolve({ success: false, reason: 'install_failed', code });
      }
    });
  });
}


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
