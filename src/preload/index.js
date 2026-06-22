import { contextBridge } from 'electron'
// API surface filled in later tasks.
contextBridge.exposeInMainWorld('api', {})
