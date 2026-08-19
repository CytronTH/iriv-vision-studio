const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  // File dialogs
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  openFileDialog: (filters) => ipcRenderer.invoke('open-file-dialog', filters),
  saveFileDialog: (name) => ipcRenderer.invoke('save-file-dialog', name),
  // Backend
  getBackendPort: () => ipcRenderer.invoke('get-backend-port'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  // Setup
  checkPython: () => ipcRenderer.invoke('check-python'),
  installPython: () => ipcRenderer.invoke('install-python'),
  onPythonInstallLog: (cb) => ipcRenderer.on('python-install-log', (_, data) => cb(data)),
  runSetup: () => ipcRenderer.invoke('run-setup'),
  onSetupLog: (cb) => ipcRenderer.on('setup-log', (_, data) => cb(data)),
  // Auto-Update
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (_, data) => cb(data)),
  // Debug
  getDebugInfo: () => ipcRenderer.invoke('get-debug-info'),
  onBackendError: (cb) => ipcRenderer.on('backend-error', (_, data) => cb(data)),
  resetAndReinstall: () => ipcRenderer.invoke('reset-and-reinstall'),
  onDebugLog: (cb) => ipcRenderer.on('debug-log', (_, entry) => cb(entry)),
  // Hailo Docker Setup
  checkHailoFlag: () => ipcRenderer.invoke('check-hailo-flag'),
  markHailoReady: () => ipcRenderer.invoke('mark-hailo-ready'),
  checkDocker: () => ipcRenderer.invoke('check-docker'),
  checkHailoImage: (img) => ipcRenderer.invoke('check-hailo-image', img),
  openWhlDialog: () => ipcRenderer.invoke('open-whl-dialog'),
  buildHailoImage: (whlPath) => ipcRenderer.invoke('build-hailo-image', whlPath),
  onHailoBuildLog: (cb) => ipcRenderer.on('hailo-build-log', (_, line) => cb(line)),
});
