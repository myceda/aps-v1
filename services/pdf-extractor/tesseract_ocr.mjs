import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createWorker } = require('C:/Users/Luna/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/tesseract.js/src/index.js');

const [, , langPath, ...imagePaths] = process.argv;

async function main() {
  if (!langPath || imagePaths.length === 0) {
    console.log(JSON.stringify({ text: '', error: 'missing OCR inputs' }));
    return;
  }

  const worker = await createWorker('tha+eng', 1, {
    langPath,
    cachePath: langPath,
    gzip: true,
    logger: () => {},
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: '6',
      preserve_interword_spaces: '1',
    });

    const textParts = [];
    for (const imagePath of imagePaths) {
      const result = await worker.recognize(imagePath);
      textParts.push(result.data.text || '');
    }
    console.log(JSON.stringify({ text: textParts.join('\n') }, null, 0));
  } finally {
    await worker.terminate();
  }
}

main().catch((error) => {
  console.log(JSON.stringify({ text: '', error: error.message || 'OCR failed' }));
});
