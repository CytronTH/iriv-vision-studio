const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  openFileDialog: (filters) => ipcRenderer.invoke('open-file-dialog', filters),
  saveFileDialog: (defaultName) => ipcRenderer.invoke('save-file-dialog', defaultName),
  getBackendPort: () => ipcRenderer.invoke('get-backend-port'),
});
