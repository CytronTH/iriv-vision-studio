const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let pythonProcess = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const FRONTEND_URL = isDev ? 'http://localhost:5174' : `file://${path.join(__dirname, '../frontend/dist/index.html')}`;
const BACKEND_PORT = 7654;

function startPythonBackend() {
  const backendPath = path.join(__dirname, '../backend/main.py');
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  
  pythonProcess = spawn(pythonCmd, [backendPath, '--port', BACKEND_PORT], {
    cwd: path.join(__dirname, '../backend'),
    stdio: ['pipe', 'pipe', 'pipe']
  });

  pythonProcess.stdout.on('data', (data) => console.log('[Backend]', data.toString()));
  pythonProcess.stderr.on('data', (data) => console.error('[Backend ERR]', data.toString()));
  pythonProcess.on('close', (code) => console.log(`Python exited with code ${code}`));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    frame: false,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '../frontend/public/icon.png')
  });

  mainWindow.loadURL(FRONTEND_URL);
  if (isDev) mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  startPythonBackend();
  setTimeout(createWindow, 2000); // Wait for backend to start
});

app.on('window-all-closed', () => {
  if (pythonProcess) pythonProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers for file dialogs
ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
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
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'model.hef'
  });
  return result.filePath;
});

ipcMain.handle('get-backend-port', () => BACKEND_PORT);
