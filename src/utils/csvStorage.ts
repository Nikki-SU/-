import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

const STORAGE_KEY_PREFIX = 'quiz_app_';

function isWeb(): boolean {
  return Platform.OS === 'web';
}

export function parseCSV<T>(csvString: string): T[] {
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const obj: any = {};
    headers.forEach((h, i) => {
      let val = values[i] || '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      obj[h] = val.replace(/\\\|/g, '|');
    });
    return obj as T;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function stringifyCSV<T extends Record<string, any>>(data: T[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map((obj) =>
    headers
      .map((h) => {
        let val = String(obj[h] || '');
        val = val.replace(/\|/g, '\\|');
        if (val.includes(',') || val.includes('"') || val.includes('|')) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      })
      .join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

export async function writeCSV(filename: string, data: any[]): Promise<void> {
  const content = stringifyCSV(data);

  if (isWeb()) {
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + filename, content);
    } catch (e) {
      console.warn('localStorage write failed:', e);
    }
    return;
  }

  try {
    const path = `${FileSystem.documentDirectory || './data/'}${filename}`;
    await FileSystem.writeAsStringAsync(path, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch (e) {
    console.warn('File write failed:', e);
  }
}

export async function readCSV<T>(filename: string): Promise<T[]> {
  if (isWeb()) {
    try {
      const content = localStorage.getItem(STORAGE_KEY_PREFIX + filename);
      if (!content) return [];
      return parseCSV<T>(content);
    } catch {
      return [];
    }
  }

  try {
    const path = `${FileSystem.documentDirectory || './data/'}${filename}`;
    const content = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return parseCSV<T>(content);
  } catch {
    return [];
  }
}

export async function ensureDataDir(): Promise<void> {
  if (isWeb()) {
    return;
  }

  try {
    const dirInfo = await FileSystem.getInfoAsync(
      FileSystem.documentDirectory || './data/'
    );
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(
        FileSystem.documentDirectory || './data/',
        { intermediates: true }
      );
    }
  } catch (e) {
    console.warn('ensureDataDir failed:', e);
  }
}