const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow;
let pythonProcess = null;
let setupProcess = null;

const isDev = !app.isPackaged;
const BACKEND_PORT = 7654;
const SETUP_FLAG = path.join(app.getPath('userData'), 'setup_complete.flag');

// ── Resolve paths correctly for both dev and packaged mode ─────────
function getBackendDir() {
  if (isDev) return path.join(__dirname, '../backend');
  // Packaged: backend is in app.asar.unpacked (via asarUnpack config)
  return path.join(process.resourcesPath, 'app.asar.unpacked', 'backend');
}

function getSetupScriptPath() {
  const isWin = os.platform() === 'win32';
  const scriptName = isWin ? 'setup.bat' : 'setup.sh';
  if (isDev) return path.join(__dirname, '..', scriptName);
  // extraResources go to process.resourcesPath
  return path.join(process.resourcesPath, scriptName);
}

function getFrontendUrl(showSetup = false) {
  const query = showSetup ? '?setup=1' : '';
  if (isDev) return `http://localhost:5174${query}`;
  return `file://${path.join(__dirname, '../frontend/dist/index.html')}${query}`;
}

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
      const out = execSync(`${cmd} --version 2>&1`, { stdio: 'pipe', shell: true }).toString();
      if (out.includes('Python 3')) return cmd;
    } catch {}
  }
  return null;
}

// ── Start Python backend ──────────────────────────────────────────
function startPythonBackend() {
  const backendDir = getBackendDir();
  const backendMain = path.join(backendDir, 'main.py');
  const isWin = os.platform() === 'win32';
  const venvPython = isWin
    ? path.join(app.getPath('userData'), 'venv', 'Scripts', 'python.exe')
    : path.join(app.getPath('userData'), 'venv', 'bin', 'python3');

  const usePython = fs.existsSync(venvPython) ? venvPython : (getPythonCmd() || 'python');

  console.log('[Backend] Starting:', usePython, backendMain);

  pythonProcess = spawn(usePython, [backendMain, '--port', String(BACKEND_PORT)], {
    cwd: backendDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
    env: { ...process.env }
  });

  pythonProcess.stdout.on('data', d => console.log('[Backend]', d.toString().trim()));
  pythonProcess.stderr.on('data', d => console.error('[Backend ERR]', d.toString().trim()));
  pythonProcess.on('close', code => console.log(`Python process exited: ${code}`));
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
    mainWindow.loadURL(getFrontendUrl(showSetup));
  } else {
    mainWindow.loadFile(
      path.join(__dirname, '../frontend/dist/index.html'),
      showSetup ? { query: { setup: '1' } } : {}
    );
  }
}

// ── App lifecycle ─────────────────────────────────────────────────
app.whenReady().then(() => {
  const needsSetup = !isSetupComplete();
  createWindow(needsSetup);
  if (!needsSetup) startPythonBackend();
});

app.on('window-all-closed', () => {
  if (pythonProcess) { try { pythonProcess.kill(); } catch {} }
  if (setupProcess) { try { setupProcess.kill(); } catch {} }
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
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return r.filePaths[0] || null;
});
ipcMain.handle('open-file-dialog', async (e, filters) => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }]
  });
  return r.filePaths;
});
ipcMain.handle('save-file-dialog', async (e, defaultName) => {
  const r = await dialog.showSaveDialog(mainWindow, { defaultPath: defaultName || 'model.hef' });
  return r.filePath;
});
ipcMain.handle('get-backend-port', () => BACKEND_PORT);
ipcMain.handle('open-external', (e, url) => shell.openExternal(url));

// ── IPC: Python check ─────────────────────────────────────────────
ipcMain.handle('check-python', () => {
  const cmd = getPythonCmd();
  if (!cmd) return { found: false };
  try {
    const ver = execSync(`${cmd} --version 2>&1`, { stdio: 'pipe', shell: true }).toString().trim();
    return { found: true, version: ver, cmd };
  } catch {
    return { found: false };
  }
});

// ── IPC: Auto-install Python ──────────────────────────────────────
ipcMain.handle('install-python', async () => {
  return new Promise((resolve) => {
    const isWin = os.platform() === 'win32';
    const sendLog = (msg) => mainWindow?.webContents.send('python-install-log', msg);

    if (!isWin) {
      sendLog('Running: sudo apt install python3...');
      const proc = spawn('bash', ['-c', 'sudo apt-get install -y python3 python3-pip python3-venv'], { shell: false });
      proc.stdout.on('data', d => sendLog(d.toString()));
      proc.stderr.on('data', d => sendLog(d.toString()));
      proc.on('close', code => resolve({ success: code === 0 }));
      return;
    }

    const PYTHON_VERSION = '3.12.5';
    const PYTHON_URL = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-amd64.exe`;
    const installerPath = path.join(os.tmpdir(), 'python_installer.exe');

    // Try winget first
    sendLog('Checking for winget...');
    let wingetAvailable = false;
    try { execSync('winget --version', { stdio: 'pipe', shell: true }); wingetAvailable = true; } catch {}

    if (wingetAvailable) {
      sendLog('✅ winget found! Installing Python 3.12...');
      const proc = spawn('winget', [
        'install', 'Python.Python.3.12',
        '--silent', '--accept-source-agreements', '--accept-package-agreements', '--scope', 'user'
      ], { shell: true });
      proc.stdout.on('data', d => sendLog(d.toString()));
      proc.stderr.on('data', d => sendLog(d.toString()));
      proc.on('close', code => {
        if (code === 0) { sendLog('__PYTHON_INSTALLED__'); resolve({ success: true }); }
        else { sendLog('winget failed, trying direct download...'); installViaDirect(installerPath, PYTHON_URL, sendLog, resolve); }
      });
    } else {
      sendLog('Downloading Python installer from python.org...');
      installViaDirect(installerPath, PYTHON_URL, sendLog, resolve);
    }
  });
});

function installViaDirect(installerPath, url, sendLog, resolve) {
  sendLog('Downloading Python 3.12.5 (may take 1-2 min)...');
  const downloadCmd = `(New-Object Net.WebClient).DownloadFile('${url}','${installerPath}')`;
  const dlProc = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', downloadCmd], { shell: true });
  dlProc.on('close', dlCode => {
    if (dlCode !== 0) { sendLog('__PYTHON_FAILED__: Download failed'); resolve({ success: false }); return; }
    sendLog('Download complete. Installing silently...');
    const installProc = spawn(installerPath, [
      '/quiet', 'InstallAllUsers=0', 'PrependPath=1',
      'Include_test=0', 'Include_doc=0', 'Include_launcher=1'
    ], { shell: false });
    installProc.on('close', code => {
      try { fs.unlinkSync(installerPath); } catch {}
      if (code === 0) { sendLog('__PYTHON_INSTALLED__'); resolve({ success: true }); }
      else { sendLog(`__PYTHON_FAILED__: code ${code}`); resolve({ success: false }); }
    });
  });
}

// ── IPC: Run setup (install Python deps) ─────────────────────────
ipcMain.handle('run-setup', async () => {
  return new Promise((resolve) => {
    const isWin = os.platform() === 'win32';
    const scriptPath = getSetupScriptPath();
    const backendDir = getBackendDir();
    // venv will be created in userData so it persists between updates
    const venvDir = path.join(app.getPath('userData'), 'venv');

    console.log('[Setup] Script:', scriptPath);
    console.log('[Setup] BackendDir:', backendDir);
    console.log('[Setup] VenvDir:', venvDir);

    const sendLog = (text) => mainWindow?.webContents.send('setup-log', text);

    // ── Run setup.bat / setup.sh with shell:true so cmd.exe is found correctly ──
    const proc = isWin
      ? spawn(scriptPath, [], {
          cwd: backendDir,
          shell: true,              // ← KEY FIX: shell:true resolves cmd.exe correctly
          env: { ...process.env, VENV_DIR: venvDir, BACKEND_DIR: backendDir }
        })
      : spawn('bash', [scriptPath], {
          cwd: backendDir,
          shell: false,
          env: { ...process.env, VENV_DIR: venvDir, BACKEND_DIR: backendDir }
        });

    setupProcess = proc;

    proc.stdout.on('data', d => sendLog(d.toString()));
    proc.stderr.on('data', d => sendLog('[stderr] ' + d.toString()));
    proc.on('error', err => {
      sendLog(`__SETUP_FAILED__: ${err.message}`);
      resolve({ success: false });
    });
    proc.on('close', code => {
      if (code === 0) {
        markSetupComplete();
        sendLog('__SETUP_COMPLETE__');
        startPythonBackend();
        resolve({ success: true });
      } else {
        sendLog(`__SETUP_FAILED__:${code}`);
        resolve({ success: false, code });
      }
    });
  });
});
