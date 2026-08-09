import { writeFile, readFile, downloadFile } from './fileStorage';

export function parseCSV<T>(csvString: string): T[] {
  if (!csvString || !csvString.trim()) return [];
  
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < csvString.length) {
    const char = csvString[i];
    
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < csvString.length && csvString[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRecord.push(currentField);
        currentField = '';
        i++;
        continue;
      } else if (char === '\n') {
        currentRecord.push(currentField);
        currentField = '';
        if (currentRecord.length > 0 || csvString[i + 1] !== undefined) {
          records.push(currentRecord);
          currentRecord = [];
        }
        i++;
        continue;
      } else if (char === '\r') {
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }
  
  if (currentField.length > 0 || currentRecord.length > 0) {
    currentRecord.push(currentField);
    records.push(currentRecord);
  }
  
  if (records.length === 0) return [];
  
  const headers = records[0];
  return records.slice(1).filter(r => r.length > 0 || r.join('').trim()).map((values) => {
    const obj: any = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] || '';
    });
    return obj as T;
  });
}

export function stringifyCSV<T extends Record<string, any>>(data: T[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  
  const escapeField = (val: string): string => {
    if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };
  
  const rows = data.map((obj) =>
    headers
      .map((h) => escapeField(String(obj[h] ?? '')))
      .join(',')
  );
  
  return [headers.join(','), ...rows].join('\n');
}

export async function writeCSV(filename: string, data: any[]): Promise<void> {
  const content = stringifyCSV(data);
  await writeFile(filename, content);
}

export async function readCSV<T>(filename: string): Promise<T[]> {
  const content = await readFile(filename);
  if (!content) return [];
  return parseCSV<T>(content);
}

export async function exportCSV(filename: string, data: any[]): Promise<void> {
  const content = stringifyCSV(data);
  await downloadFile(filename, content, 'text/csv');
}

export async function exportMarkdown(filename: string, content: string): Promise<void> {
  await downloadFile(filename, content, 'text/markdown');
}
