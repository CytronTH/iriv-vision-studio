const { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const { autoUpdater } = require('electron-updater');

// electron-updater config
autoUpdater.autoDownload = true;        // download silently in background
autoUpdater.autoInstallOnAppQuit = false; // ask user before installing

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

// ── Kill stale process on port ────────────────────────────────────
function killPort(port) {
  const isWin = os.platform() === 'win32';
  try {
    if (isWin) {
      // `:7654` matches both 127.0.0.1:7654 and 0.0.0.0:7654
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', timeout: 3000 });
      const pids = new Set();
      out.split('\n').forEach(line => {
        const parts = line.trim().split(/\s+/);
        // parts: [TCP, LocalAddr, ForeignAddr, State, PID]
        // Only kill if LOCAL address ends with :port (not foreign address)
        if (parts.length >= 5 && parts[1] && parts[1].endsWith(`:${port}`)) {
          const pid = parts[parts.length - 1];
          if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
        }
      });
      if (pids.size > 0) {
        pids.forEach(pid => {
          try {
            execSync(`taskkill /PID ${pid} /F`, { timeout: 3000 });
            console.log('[Backend] Killed stale PID:', pid, 'on port', port);
          } catch (e) {
            console.warn('[Backend] Could not kill PID', pid, ':', e.message);
          }
        });
        // Give OS time to release the port
        const deadline = Date.now() + 1000;
        while (Date.now() < deadline) { /* spin */ }
      } else {
        console.log('[Backend] Port', port, 'is free');
      }
    } else {
      execSync(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, { timeout: 3000 });
    }
  } catch {
    // No process found on port — that's fine
    console.log('[Backend] Port', port, 'is free (no output from netstat)');
  }
}

// ── Debug Window ─────────────────────────────────────────────────
let debugWindow = null;

function sendDebugLog(level, message) {
  const entry = { ts: new Date().toISOString(), level, message };
  try {
    if (debugWindow && !debugWindow.isDestroyed()) {
      debugWindow.webContents.send('debug-log', entry);
    }
  } catch {}
}

function createDebugWindow() {
  debugWindow = new BrowserWindow({
    width: 800,
    height: 500,
    minWidth: 600,
    minHeight: 300,
    title: 'IRIV Model Studio — Debug Console',
    backgroundColor: '#0a0c10',
    frame: true,  // use native frame so it's a clear separate window
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  debugWindow.loadFile(path.join(__dirname, 'debug.html'));
  debugWindow.setMenu(null);
  debugWindow.on('closed', () => { debugWindow = null; });
  return debugWindow;
}

function findVenvPython() {
  const isWin = os.platform() === 'win32';
  const backendDir = getBackendDir();

  // All possible venv locations (new → old for backwards compat)
  const candidates = isWin ? [
    path.join(app.getPath('userData'), 'venv', 'Scripts', 'python.exe'),   // new (userData)
    path.join(backendDir, 'venv', 'Scripts', 'python.exe'),                 // old (backend/venv)
    path.join(__dirname, '../backend/venv/Scripts/python.exe'),              // dev fallback
  ] : [
    path.join(app.getPath('userData'), 'venv', 'bin', 'python3'),
    path.join(backendDir, 'venv', 'bin', 'python3'),
    path.join(__dirname, '../backend/venv/bin/python3'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log('[Backend] Found venv python:', p);
      return p;
    }
  }
  console.warn('[Backend] No venv found, falling back to system python');
  return getPythonCmd() || 'python';
}

function isVenvReady() {
  const isWin = os.platform() === 'win32';
  const backendDir = getBackendDir();
  const checks = isWin ? [
    path.join(app.getPath('userData'), 'venv', 'Scripts', 'python.exe'),
    path.join(backendDir, 'venv', 'Scripts', 'python.exe'),
  ] : [
    path.join(app.getPath('userData'), 'venv', 'bin', 'python3'),
    path.join(backendDir, 'venv', 'bin', 'python3'),
  ];
  return checks.some(p => fs.existsSync(p));
}

function startPythonBackend() {
  const backendDir = getBackendDir();
  const backendMain = path.join(backendDir, 'main.py');
  const usePython = findVenvPython();

  if (!fs.existsSync(backendMain)) {
    console.error('[Backend] main.py not found at:', backendMain);
    mainWindow?.webContents.send('backend-error', 'main.py not found: ' + backendMain);
    return;
  }

  // Ensure critical runtime packages are present (patches old venvs silently)
  console.log('[Backend] Checking critical packages (websockets, uvicorn[standard])...');
  const pipCheck = spawn(usePython, ['-m', 'pip', 'install', '--quiet',
    'uvicorn[standard]', 'websockets'
  ], { shell: false, stdio: 'pipe' });

  pipCheck.on('close', (code) => {
    if (code === 0) {
      console.log('[Backend] Critical packages OK');
    } else {
      console.warn('[Backend] pip install check returned code', code, '(non-fatal)');
    }
    launchBackend(usePython, backendMain, backendDir);
  });
  pipCheck.on('error', (err) => {
    console.warn('[Backend] pip check failed:', err.message, '— starting anyway');
    launchBackend(usePython, backendMain, backendDir);
  });
}

function launchBackend(usePython, backendMain, backendDir) {
  // Kill any stale process occupying the port (e.g. from previous crash)
  console.log('[Backend] Clearing port', BACKEND_PORT, '...');
  killPort(BACKEND_PORT);

  console.log('[Backend] Starting:', usePython, backendMain);
  console.log('[Backend] cwd:', backendDir);

  pythonProcess = spawn(usePython, [backendMain, '--port', String(BACKEND_PORT)], {
    cwd: backendDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
    env: { ...process.env }
  });

  pythonProcess.stdout.on('data', d => console.log('[Backend]', d.toString().trim()));
  pythonProcess.stderr.on('data', d => console.error('[Backend ERR]', d.toString().trim()));
  pythonProcess.on('error', err => console.error('[Backend] spawn error:', err.message));
  pythonProcess.on('close', code => {
    console.log(`Python process exited: ${code}`);
    mainWindow?.webContents.send('backend-error', `Python backend exited with code ${code}`);
  });
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

  // F12 = toggle DevTools (always available for debugging)
  globalShortcut.register('F12', () => {
    mainWindow?.webContents.toggleDevTools();
  });
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    mainWindow?.webContents.toggleDevTools();
  });

  if (isDev) {
    mainWindow.loadURL(getFrontendUrl(showSetup));
  } else {
    mainWindow.loadFile(
      path.join(__dirname, '../frontend/dist/index.html'),
      showSetup ? { query: { setup: '1' } } : {}
    );
  }

  // Log to file AND debug window
  const logPath = path.join(app.getPath('userData'), 'debug.log');
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  const origLog = console.log.bind(console);
  const origErr = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  const ts = () => new Date().toISOString();

  function parseLevel(args) {
    const msg = args.join(' ');
    if (msg.startsWith('[Backend ERR]') || msg.startsWith('[Error]')) return 'ERROR';
    if (msg.startsWith('[Backend]')) return 'BACKEND';
    if (msg.startsWith('[Setup]')) return 'SETUP';
    if (msg.startsWith('[App]') || msg.startsWith('[Update]')) return 'SYSTEM';
    return 'INFO';
  }

  console.log = (...a) => {
    origLog(...a);
    const msg = a.join(' ');
    logStream.write(`[${ts()}] INFO  ${msg}\n`);
    sendDebugLog(parseLevel(a), msg);
  };
  console.error = (...a) => {
    origErr(...a);
    const msg = a.join(' ');
    logStream.write(`[${ts()}] ERROR ${msg}\n`);
    sendDebugLog('ERROR', msg);
  };
  console.warn = (...a) => {
    origWarn(...a);
    const msg = a.join(' ');
    logStream.write(`[${ts()}] WARN  ${msg}\n`);
    sendDebugLog('WARN', msg);
  };

  console.log('[App] Log started. userData:', app.getPath('userData'));
}

// ── App lifecycle ─────────────────────────────────────────────────
app.whenReady().then(() => {
  // Always open debug window first
  createDebugWindow();

  const setupDone = isSetupComplete();

  // If setup flag exists but venv is missing → force re-setup
  if (setupDone && !isVenvReady()) {
    console.warn('[App] Setup flag found but venv missing — resetting setup');
    try { fs.unlinkSync(SETUP_FLAG); } catch {}
    createWindow(true);
    return;
  }

  const needsSetup = !setupDone;
  createWindow(needsSetup);
  if (!needsSetup) {
    startPythonBackend();
    if (!isDev) setTimeout(() => initAutoUpdater(), 5000);
  }
});

app.on('window-all-closed', () => {
  // Only quit when main window is closed (debug window close shouldn't quit app)
  if (!mainWindow || mainWindow.isDestroyed()) {
    if (pythonProcess) { try { pythonProcess.kill(); } catch {} }
    if (setupProcess) { try { setupProcess.kill(); } catch {} }
    if (process.platform !== 'darwin') app.quit();
  }
});

// When main window closes, also close debug window
ipcMain.handle('window-close', () => {
  if (debugWindow && !debugWindow.isDestroyed()) debugWindow.close();
  mainWindow?.close();
});

// ── IPC: Window controls ────────────────────────────────────────────
ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => {
  mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});


// IPC: Debug info
ipcMain.handle('get-debug-info', () => {
  const isWin = os.platform() === 'win32';
  const backendDir = getBackendDir();
  const userData = app.getPath('userData');
  const venvPath = isWin
    ? path.join(userData, 'venv', 'Scripts', 'python.exe')
    : path.join(userData, 'venv', 'bin', 'python3');
  const venvPathOld = isWin
    ? path.join(backendDir, 'venv', 'Scripts', 'python.exe')
    : path.join(backendDir, 'venv', 'bin', 'python3');

  return {
    version: app.getVersion(),
    platform: os.platform(),
    userData,
    backendDir,
    backendMain: path.join(backendDir, 'main.py'),
    backendMainExists: fs.existsSync(path.join(backendDir, 'main.py')),
    venvPath,
    venvExists: fs.existsSync(venvPath),
    venvPathOld,
    venvOldExists: fs.existsSync(venvPathOld),
    setupFlagExists: fs.existsSync(SETUP_FLAG),
    backendPort: BACKEND_PORT,
    logFile: path.join(userData, 'debug.log'),
    pythonCmd: getPythonCmd(),
    backendRunning: !!pythonProcess && !pythonProcess.killed,
  };
});

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

    sendLog(`[Setup] Script: ${scriptPath}`);
    sendLog(`[Setup] BackendDir: ${backendDir}`);
    sendLog(`[Setup] VenvDir: ${venvDir}`);

    let proc;
    if (isWin) {
      // Use ComSpec (full path to cmd.exe, e.g. C:\Windows\System32\cmd.exe)
      // Pass script path as argument — cmd.exe handles quoted paths with spaces correctly
      const cmdExe = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';
      proc = spawn(cmdExe, ['/c', scriptPath], {
        cwd: backendDir,
        shell: false,   // shell:false because we're calling cmd.exe directly
        env: { ...process.env, VENV_DIR: venvDir, BACKEND_DIR: backendDir }
      });
    } else {
      proc = spawn('bash', [scriptPath], {
        cwd: backendDir,
        env: { ...process.env, VENV_DIR: venvDir, BACKEND_DIR: backendDir }
      });
    }

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

// \u2500\u2500 Auto-Updater \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function initAutoUpdater() {
  // Forward all updater events to the renderer
  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update-status', { type: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-status', {
      type: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes || ''
    });
    // autoDownload:true will start downloading automatically
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-status', { type: 'not-available' });
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-status', {
      type: 'downloading',
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-status', {
      type: 'downloaded',
      version: info.version
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err.message);
    mainWindow?.webContents.send('update-status', { type: 'error', message: err.message });
  });

  // Kick off the check
  autoUpdater.checkForUpdates().catch(err => {
    console.error('[AutoUpdater] checkForUpdates failed:', err.message);
  });
}

// IPC: User clicked "Install Update Now"
ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true); // isSilent=false, isForceRunAfter=true
});

// IPC: Manually trigger update check
ipcMain.handle('check-for-update', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, version: result?.updateInfo?.version };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: Get current app version
ipcMain.handle('get-app-version', () => app.getVersion());

// IPC: Reset setup and reinstall (clears flag, kills backend, reloads to setup)
ipcMain.handle('reset-and-reinstall', () => {
  try {
    // Kill running backend
    if (pythonProcess) { try { pythonProcess.kill(); } catch {} pythonProcess = null; }
    // Remove setup flag so setup wizard shows on next load
    try { fs.unlinkSync(SETUP_FLAG); } catch {}
    // Remove old venv so setup creates fresh one
    const isWin = os.platform() === 'win32';
    const userData = app.getPath('userData');
    const venvDir = path.join(userData, 'venv');
    if (fs.existsSync(venvDir)) {
      fs.rmSync(venvDir, { recursive: true, force: true });
      console.log('[App] Removed old venv:', venvDir);
    }
    // Reload the window to show setup wizard
    setTimeout(() => {
      mainWindow?.loadFile(
        path.join(__dirname, '../frontend/dist/index.html'),
        { query: { setup: '1' } }
      );
    }, 500);
    return { success: true };
  } catch (err) {
    console.error('[App] reset-and-reinstall error:', err.message);
    return { success: false, error: err.message };
  }
});
