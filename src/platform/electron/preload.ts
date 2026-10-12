import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('michelleShell', { name: 'electron' })
