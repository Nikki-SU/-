import { Platform } from 'react-native';

export type FileSystemDirectoryHandle = any;

let _dirHandle: FileSystemDirectoryHandle | null = null;
let _basePath: string | null = null;

const DEFAULT_DIR_NAME = 'quiz_app_data';
const STORAGE_KEY_PATH = 'quiz_app_storage_path';
const STORAGE_KEY_INIT = 'quiz_app_initialized';
const STORAGE_KEY_LS_PREFIX = 'quiz_app_file_';

function isWeb(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function isFileSystemAccessSupported(): boolean {
  if (!isWeb()) return false;
  return typeof (window as any).showDirectoryPicker === 'function';
}

export function clearOldLocalStorageData(): void {
  if (!isWeb()) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_LS_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch {}
}

export async function setDataPath(path: string): Promise<void> {
  _basePath = path;
  if (isWeb()) {
    try {
      localStorage.setItem(STORAGE_KEY_PATH, path);
      localStorage.setItem(STORAGE_KEY_INIT, 'true');
    } catch {}
  }
}

export function getDataPath(): string | null {
  if (_basePath) return _basePath;
  if (isWeb()) {
    try {
      return localStorage.getItem(STORAGE_KEY_PATH);
    } catch {
      return null;
    }
  }
  return null;
}

export function hasInitializedPath(): boolean {
  if (isWeb()) {
    try {
      return localStorage.getItem(STORAGE_KEY_INIT) === 'true';
    } catch {
      return false;
    }
  }
  return false;
}

export async function selectWebDirectory(): Promise<string | null> {
  if (!isWeb()) return null;
  if (!isFileSystemAccessSupported()) return null;

  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    });
    _dirHandle = handle;
    await saveDirHandleToIDDB(handle);
    const path = handle.name;
    setDataPath(path);
    return path;
  } catch {
    return null;
  }
}

const IDDB_NAME = 'quiz_app_fs';
const IDDB_STORE = 'handles';
const IDDB_KEY = 'root';

async function openIDDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDDB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(IDDB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveDirHandleToIDDB(handle: FileSystemDirectoryHandle): Promise<void> {
  if (!isWeb()) return;
  try {
    const db = await openIDDB();
    const tx = db.transaction(IDDB_STORE, 'readwrite');
    tx.objectStore(IDDB_STORE).put(handle, IDDB_KEY);
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Failed to save dir handle to IDDB:', e);
  }
}

async function loadDirHandleFromIDDB(): Promise<FileSystemDirectoryHandle | null> {
  if (!isWeb()) return null;
  try {
    const db = await openIDDB();
    const tx = db.transaction(IDDB_STORE, 'readonly');
    const request = tx.objectStore(IDDB_STORE).get(IDDB_KEY);
    return new Promise<FileSystemDirectoryHandle | null>((resolve) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function getDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (_dirHandle) return _dirHandle;
  if (!isWeb()) return null;

  const saved = await loadDirHandleFromIDDB();
  if (saved) {
    try {
      const permissions = await (saved as any).queryPermission?.({ mode: 'readwrite' });
      if (permissions === 'granted') {
        _dirHandle = saved;
        _basePath = (saved as any).name || null;
        if (_basePath) {
          localStorage.setItem(STORAGE_KEY_PATH, _basePath);
          localStorage.setItem(STORAGE_KEY_INIT, 'true');
        }
        return saved;
      }
    } catch (e) {
      console.warn('Failed to restore dir handle:', e);
    }
  }
  return null;
}

export async function autoRestoreDirectory(): Promise<boolean> {
  if (!isWeb()) return false;
  
  const path = getDataPath();
  if (!path) return false;
  
  try {
    const handle = await loadDirHandleFromIDDB();
    if (handle) {
      _dirHandle = handle;
      return true;
    }
  } catch (e) {
    console.warn('Failed to restore dir handle:', e);
  }
  
  return false;
}

async function writeFileWeb(filename: string, content: string): Promise<void> {
  if (!isWeb()) return;
  
  const handle = await getDirHandle();
  if (!handle) {
    throw new Error('NO_DIRECTORY');
  }
  
  try {
    const fileHandle = await handle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  } catch (e) {
    console.error('writeFileWeb failed:', e);
    throw e;
  }
}

async function readFileWeb(filename: string): Promise<string | null> {
  if (!isWeb()) return null;
  
  const handle = await getDirHandle();
  if (!handle) {
    return null;
  }
  
  try {
    const fileHandle = await handle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

async function removeFileWeb(filename: string): Promise<void> {
  if (!isWeb()) return;
  
  const handle = await getDirHandle();
  if (!handle) {
    throw new Error('NO_DIRECTORY');
  }
  
  try {
    await handle.removeEntry(filename);
  } catch {}
}

function getNativeDirPath(): string {
  const path = getDataPath();
  if (path) {
    return path.endsWith('/') ? path : path + '/';
  }
  const FileSystemAny = FileSystem as any;
  const base = FileSystemAny.documentDirectory || './';
  return base + DEFAULT_DIR_NAME + '/';
}

async function ensureNativeDir(): Promise<void> {
  if (isWeb()) return;
  const dirPath = getNativeDirPath();
  const FileSystemAny = FileSystem as any;
  try {
    const info = await FileSystemAny.getInfoAsync(dirPath);
    if (!info.exists) {
      await FileSystemAny.makeDirectoryAsync(dirPath, { intermediates: true });
    }
  } catch (e) {
    console.warn('ensureNativeDir failed:', e);
  }
}

export async function ensureDataDir(): Promise<void> {
  if (!isWeb()) {
    await ensureNativeDir();
  }
}

async function writeFileNative(filename: string, content: string): Promise<void> {
  if (isWeb()) return;
  await ensureNativeDir();
  const path = getNativeDirPath() + filename;
  const FileSystemAny = FileSystem as any;
  await FileSystemAny.writeAsStringAsync(path, content, {
    encoding: FileSystemAny.EncodingType.UTF8,
  });
}

async function readFileNative(filename: string): Promise<string | null> {
  if (isWeb()) return null;
  await ensureNativeDir();
  const path = getNativeDirPath() + filename;
  const FileSystemAny = FileSystem as any;
  try {
    return await FileSystemAny.readAsStringAsync(path, {
      encoding: FileSystemAny.EncodingType.UTF8,
    });
  } catch {
    return null;
  }
}

async function removeFileNative(filename: string): Promise<void> {
  if (isWeb()) return;
  const path = getNativeDirPath() + filename;
  const FileSystemAny = FileSystem as any;
  try {
    const info = await FileSystemAny.getInfoAsync(path);
    if (info.exists) {
      await FileSystemAny.deleteAsync(path);
    }
  } catch {}
}

export async function writeFile(filename: string, content: string): Promise<void> {
  if (isWeb()) {
    await writeFileWeb(filename, content);
  } else {
    await writeFileNative(filename, content);
  }
}

export async function readFile(filename: string): Promise<string | null> {
  if (isWeb()) {
    return readFileWeb(filename);
  } else {
    return readFileNative(filename);
  }
}

export async function removeFile(filename: string): Promise<void> {
  if (isWeb()) {
    await removeFileWeb(filename);
  } else {
    await removeFileNative(filename);
  }
}

export async function removeBankFiles(bankId: string): Promise<void> {
  const files = [
    `bank_${bankId}_questions.csv`,
    `bank_${bankId}_progress.csv`,
    `bank_${bankId}_wrong.csv`,
    `bank_${bankId}_favorites.csv`,
    `bank_${bankId}_completed.csv`,
  ];
  for (const f of files) {
    await removeFile(f);
  }
}

export async function downloadFile(filename: string, content: string, mime?: string) {
  if (!isWeb()) return;

  const m = mime || 'text/plain';
  const blob = new Blob([content], { type: m });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function readUploadedFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function clearDirHandle(): void {
  _dirHandle = null;
  _basePath = null;
  if (isWeb()) {
    try {
      localStorage.removeItem(STORAGE_KEY_PATH);
      localStorage.removeItem(STORAGE_KEY_INIT);
      const dbPromise = indexedDB.open(IDDB_NAME, 1);
      dbPromise.onsuccess = () => {
        const db = dbPromise.result;
        const tx = db.transaction(IDDB_STORE, 'readwrite');
        tx.objectStore(IDDB_STORE).delete(IDDB_KEY);
      };
    } catch {}
  }
}

export async function listAllFiles(): Promise<string[]> {
  if (!isWeb()) return [];
  
  const handle = await getDirHandle();
  if (!handle) {
    return [];
  }
  
  try {
    const files: string[] = [];
    for await (const [name] of (handle as any).entries()) {
      files.push(name);
    }
    return files;
  } catch {
    return [];
  }
}
