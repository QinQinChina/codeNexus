import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
const srcPng = resolve(projectRoot, "CodeNexus.png");
const outDir = resolve(projectRoot, "build");
const outIco = resolve(outDir, "icon.ico");

async function fileMtimeMs(path) {
  try {
    const s = await stat(path);
    return s.mtimeMs;
  } catch {
    return -1;
  }
}

export async function ensureWinIcon() {
  await mkdir(outDir, { recursive: true });

  const srcMtime = await fileMtimeMs(srcPng);
  if (srcMtime < 0) {
    throw new Error(`CodeNexus.png not found: ${srcPng}`);
  }

  const outMtime = await fileMtimeMs(outIco);
  if (outMtime >= srcMtime) return;

  const pngToIco = require("png-to-ico")?.default;
  if (typeof pngToIco !== "function") {
    throw new Error("png-to-ico default export not found");
  }
  const pngBuf = await readFile(srcPng);
  const icoBuf = await pngToIco(pngBuf);
  await writeFile(outIco, icoBuf);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  ensureWinIcon().catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}
