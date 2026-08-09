import JSZip from 'jszip';

export interface ZipFileEntry {
  name: string;
  content: string | Uint8Array;
}

export async function createZipFromFiles(files: ZipFileEntry[]): Promise<Blob> {
  const zip = new JSZip();
  
  for (const file of files) {
    zip.file(file.name, file.content);
  }
  
  return await zip.generateAsync({ type: 'blob' });
}

export async function downloadZipBlob(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function extractZipFiles(zipBlob: Blob): Promise<Map<string, string>> {
  const zip = await JSZip.loadAsync(zipBlob);
  const result = new Map<string, string>();
  
  const entries = zip.file(/./);
  
  for (const entry of entries) {
    if (!entry.dir) {
      const content = await entry.async('string');
      result.set(entry.name, content);
    }
  }
  
  return result;
}

export async function extractZipToObject(zipBlob: Blob): Promise<Record<string, string>> {
  const map = await extractZipFiles(zipBlob);
  const obj: Record<string, string> = {};
  
  map.forEach((value, key) => {
    obj[key] = value;
  });
  
  return obj;
}

export function readZipFileAsBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Blob([reader.result as ArrayBuffer]));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}
