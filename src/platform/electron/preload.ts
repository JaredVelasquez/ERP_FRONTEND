import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('michelleShell', {
  name: 'electron',
  secureSession: {
    getRefreshToken: () => ipcRenderer.invoke('erp-session:get-refresh') as Promise<string | null>,
    setRefreshToken: (token: string) => ipcRenderer.invoke('erp-session:set-refresh', token) as Promise<void>,
    clearRefreshToken: () => ipcRenderer.invoke('erp-session:clear-refresh') as Promise<void>,
  },
})
