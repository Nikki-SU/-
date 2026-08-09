import { writeFile, readFile, downloadFile } from './fileStorage';

export function parseCSV<T>(csvString: string): T[] {
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const obj: any = {};
    headers.forEach((h, i) => {
      let val = values[i] || '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      obj[h] = val;
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
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
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
