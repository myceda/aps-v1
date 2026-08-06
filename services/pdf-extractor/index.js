import { execFile } from 'node:child_process';
import { access, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import zlib from 'node:zlib';

const execFileAsync = promisify(execFile);
const inflateRawAsync = promisify(zlib.inflateRaw);
const inflateAsync = promisify(zlib.inflate);

const minimumUsefulTextLength = 80;
const scriptDir = dirname(fileURLToPath(import.meta.url));

function getPythonCommands() {
  const bundledPython = process.env.USERPROFILE
    ? join(
      process.env.USERPROFILE,
      '.cache',
      'codex-runtimes',
      'codex-primary-runtime',
      'dependencies',
      'python',
      'python.exe',
    )
    : '';

  return [
    process.env.APS_PDF_PYTHON,
    process.env.PYTHON,
    bundledPython,
    'python',
    'py',
  ].filter(Boolean);
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getFirstExistingPath(paths) {
  for (const candidate of paths.filter(Boolean)) {
    if (await pathExists(candidate)) return candidate;
  }
  return '';
}

function isPdf(buffer) {
  return buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

function decodePdfLiteralString(value) {
  return value
    .replace(/\\([nrtbf()\\])/g, (_match, escaped) => {
      const map = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
      return map[escaped] || escaped;
    })
    .replace(/\\([0-7]{1,3})/g, (_match, octal) => String.fromCharCode(parseInt(octal, 8)));
}

function decodeHexString(value) {
  const cleanHex = value.replace(/\s+/g, '');
  const bytes = [];
  for (let index = 0; index < cleanHex.length; index += 2) {
    const byte = parseInt(cleanHex.slice(index, index + 2).padEnd(2, '0'), 16);
    if (Number.isFinite(byte)) bytes.push(byte);
  }

  return Buffer.from(bytes).toString('utf16le').replace(/\u0000/g, '').trim()
    || Buffer.from(bytes).toString('latin1');
}

function extractStringsFromContent(content) {
  const textParts = [];
  const literalPattern = /\((?:\\.|[^\\)])*\)\s*(?:Tj|'|"|\])/g;
  const hexPattern = /<([0-9A-Fa-f\s]{4,})>\s*(?:Tj|'|"|\])/g;

  for (const match of content.matchAll(literalPattern)) {
    textParts.push(decodePdfLiteralString(match[0].replace(/\)\s*(?:Tj|'|"|\])$/, '').slice(1)));
  }

  for (const match of content.matchAll(hexPattern)) {
    textParts.push(decodeHexString(match[1]));
  }

  return textParts.join(' ');
}

async function decodeStream(streamBuffer, dictionaryText) {
  if (!/\/FlateDecode\b/.test(dictionaryText)) return streamBuffer.toString('latin1');

  try {
    return (await inflateAsync(streamBuffer)).toString('latin1');
  } catch {
    return (await inflateRawAsync(streamBuffer)).toString('latin1');
  }
}

async function extractEmbeddedText(buffer) {
  const pdfText = buffer.toString('latin1');
  const textParts = [];
  const streamPattern = /([\s\S]{0,500})stream\r?\n([\s\S]*?)\r?\nendstream/g;

  for (const match of pdfText.matchAll(streamPattern)) {
    const dictionaryText = match[1];
    const streamBuffer = Buffer.from(match[2], 'latin1');
    try {
      textParts.push(extractStringsFromContent(await decodeStream(streamBuffer, dictionaryText)));
    } catch {
      textParts.push(extractStringsFromContent(streamBuffer.toString('latin1')));
    }
  }

  if (textParts.join('').trim().length === 0) {
    textParts.push(extractStringsFromContent(pdfText));
  }

  return textParts
    .join('\n')
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getReadableTextRatio(text) {
  const visibleText = String(text || '').replace(/\s+/g, '');
  if (!visibleText) return 0;

  const readableMatches = visibleText.match(/[A-Za-z0-9ก-๙]/g) || [];
  return readableMatches.length / visibleText.length;
}

async function extractWithPdfplumber(buffer, fileName) {
  const pythonCommands = getPythonCommands();
  const tempDir = await mkdtemp(`${tmpdir()}${sep}aps-transcript-`);
  const safeFileName = fileName.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'transcript.pdf';
  const filePath = `${tempDir}${sep}${safeFileName}`;
  const scriptPath = join(scriptDir, 'pdfplumber_extract.py');

  try {
    await writeFile(filePath, buffer);

    for (const command of pythonCommands) {
      try {
        const { stdout } = await execFileAsync(command, [scriptPath, filePath], {
          timeout: 30000,
          maxBuffer: 1024 * 1024 * 8,
          windowsHide: true,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        });
        const result = JSON.parse(stdout);
        if (result.text) return result.text.trim();
      } catch {
        // Try the next configured Python command.
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  return '';
}

async function extractWithOcr(buffer, fileName) {
  const tempDir = await mkdtemp(`${tmpdir()}${sep}aps-transcript-`);
  const safeFileName = fileName.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'transcript.pdf';
  const filePath = `${tempDir}${sep}${safeFileName}`;

  try {
    await writeFile(filePath, buffer);
    const tesseractText = await extractWithTesseractCli(filePath);
    if (tesseractText) return tesseractText;
    return await extractWithTesseractJs(filePath, tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function extractWithTesseractCli(filePath) {
  try {
    const { stdout } = await execFileAsync('tesseract', [filePath, 'stdout', '-l', 'tha+eng'], {
      timeout: 45000,
      maxBuffer: 1024 * 1024 * 8,
      windowsHide: true,
    });
    return stdout.trim();
  } catch {
    return '';
  }
}

async function extractWithTesseractJs(filePath, tempDir) {
  const userProfile = process.env.USERPROFILE || '';
  const pdftoppmPath = await getFirstExistingPath([
    process.env.APS_PDFTOPPM,
    userProfile ? join(userProfile, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'native', 'poppler', 'Library', 'bin', 'pdftoppm.exe') : '',
    userProfile ? join(userProfile, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'bin', 'override', 'pdftoppm.cmd') : '',
    'pdftoppm',
  ]);
  const langPath = await getFirstExistingPath([
    process.env.APS_TESSDATA_PATH,
    'C:\\Users\\MyLuna\\aps\\.next\\cache\\tessdata',
    'C:\\Users\\MyLuna\\aps\\node_modules\\@tesseract.js-data',
  ]);

  if (!pdftoppmPath || !langPath) return '';

  const outputPrefix = `${tempDir}${sep}page`;
  await execFileAsync(pdftoppmPath, ['-r', '260', '-png', '-f', '1', '-l', '8', filePath, outputPrefix], {
    timeout: 45000,
    maxBuffer: 1024 * 1024 * 4,
    windowsHide: true,
  });

  const imagePaths = (await readdir(tempDir))
    .filter((name) => /^page-\d+\.png$/i.test(name))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    .map((name) => `${tempDir}${sep}${name}`);

  if (imagePaths.length === 0) return '';

  const { stdout } = await execFileAsync(process.execPath, [join(scriptDir, 'tesseract_ocr.mjs'), langPath, ...imagePaths], {
    timeout: 120000,
    maxBuffer: 1024 * 1024 * 8,
    windowsHide: true,
  });
  const result = JSON.parse(stdout);
  return String(result.text || '').trim();
}

export async function extractPdfTranscriptText(buffer, fileName = 'transcript.pdf') {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return {
      text: '',
      method: 'none',
      status: 'failed',
      warnings: ['ไม่พบไฟล์ PDF'],
    };
  }

  if (!isPdf(buffer)) {
    return {
      text: '',
      method: 'none',
      status: 'failed',
      warnings: ['ไฟล์ที่อัปโหลดไม่ใช่ PDF ที่ถูกต้อง'],
    };
  }

  const embeddedText = await extractEmbeddedText(buffer);
  if (embeddedText.length >= minimumUsefulTextLength && getReadableTextRatio(embeddedText) >= 0.65) {
    return {
      text: embeddedText,
      method: 'pdf_text',
      status: 'success',
      warnings: [],
    };
  }

  const pdfplumberText = await extractWithPdfplumber(buffer, fileName);
  if (pdfplumberText.length >= minimumUsefulTextLength && getReadableTextRatio(pdfplumberText) >= 0.65) {
    return {
      text: pdfplumberText,
      method: 'pdfplumber',
      status: 'success',
      warnings: [],
    };
  }

  try {
    const ocrText = await extractWithOcr(buffer, fileName);
    return {
      text: ocrText,
      method: 'ocr',
      status: ocrText.length > 0 ? 'needs_review' : 'failed',
      warnings: ocrText.length > 0 ? ['ใช้ OCR fallback แล้ว โปรดตรวจทุกแถวก่อนบันทึก'] : ['OCR ไม่พบข้อความในไฟล์'],
    };
  } catch {
    return {
      text: getReadableTextRatio(embeddedText) >= 0.65 ? embeddedText : '',
      method: 'ocr_unavailable',
      status: 'needs_manual_entry',
      warnings: ['PDF นี้อาจเป็นไฟล์สแกน และยังไม่มี OCR runtime ให้ใช้งาน โปรดเพิ่มแถวหรือกรอกข้อมูลเอง'],
    };
  }
}
