import { spawn } from "node:child_process";
import { access, copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const sourceRoot = path.join(projectRoot, "public", "assets", "storytelling");
const runtimeRoot = path.join(sourceRoot, "runtime", "how-it-works");
const toolRoot = path.join(process.env.LOCALAPPDATA ?? "C:\\Users\\diaco\\AppData\\Local", "Codex", "tools", "skysend-ffmpeg", "node_modules");
const ffmpeg = process.env.SKYSEND_FFMPEG ?? path.join(toolRoot, "@ffmpeg-installer", "win32-x64", "ffmpeg.exe");
const force = process.argv.includes("--force");

function run(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: projectRoot, windowsHide: true, stdio: ["ignore", "inherit", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${label} failed with exit code ${code}.\n${stderr.slice(-8_000)}`)));
  });
}

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

async function shouldBuild(source, output) {
  if (force || !(await exists(output))) return true;
  const [sourceStats, outputStats] = await Promise.all([stat(source), stat(output)]);
  return outputStats.mtimeMs < sourceStats.mtimeMs;
}

async function poster(sourceName, outputName, { end = false, alpha = false } = {}) {
  const source = path.join(sourceRoot, sourceName);
  const output = path.join(runtimeRoot, outputName);
  if (!(await shouldBuild(source, output))) return;
  const temporary = `${output}.png`;
  const seek = end ? ["-sseof", "-0.08"] : ["-ss", "0.1"];
  await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...seek, "-i", source, "-frames:v", "1", "-vf", alpha ? "format=rgba" : "format=rgb24", temporary], `poster ${outputName}`);
  await sharp(temporary).webp({ quality: 90, alphaQuality: 100, effort: 5 }).toFile(output);
  await rm(temporary, { force: true });
}

async function copyAlphaVideo(sourceName, outputName) {
  const source = path.join(sourceRoot, sourceName);
  const output = path.join(runtimeRoot, outputName);
  if (!(await shouldBuild(source, output))) return;
  console.log(`[copy alpha] ${outputName}`);
  await copyFile(source, output);
}

async function alphaFrameSequence(sourceName, outputName) {
  const source = path.join(sourceRoot, sourceName);
  const outputDirectory = path.join(runtimeRoot, outputName);
  const marker = path.join(outputDirectory, "frame-0001.webp");
  if (!(await shouldBuild(source, marker))) return;

  const temporaryDirectory = path.join(runtimeRoot, `.${outputName}-png`);
  await rm(outputDirectory, { recursive: true, force: true });
  await rm(temporaryDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  await mkdir(temporaryDirectory, { recursive: true });

  console.log(`[frames] ${outputName}`);
  await run(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-c:v",
      "libvpx-vp9",
      "-i",
      source,
      "-an",
      "-vf",
      "format=rgba",
      "-vsync",
      "0",
      path.join(temporaryDirectory, "frame-%04d.png"),
    ],
    `alpha frames ${outputName}`,
  );

  const files = (await readdir(temporaryDirectory)).filter((name) => name.endsWith(".png")).sort();
  const batchSize = 8;
  for (let index = 0; index < files.length; index += batchSize) {
    await Promise.all(
      files.slice(index, index + batchSize).map(async (name) => {
        await sharp(path.join(temporaryDirectory, name))
          .webp({ lossless: true, effort: 4 })
          .toFile(path.join(outputDirectory, name.replace(/\.png$/, ".webp")));
      }),
    );
  }

  await rm(temporaryDirectory, { recursive: true, force: true });
  console.log(`[frames] ${outputName}: ${files.length}`);
}

async function background(sourceName, outputName, width) {
  const source = path.join(sourceRoot, sourceName);
  const output = path.join(runtimeRoot, outputName);
  if (!(await shouldBuild(source, output))) return;
  console.log(`[webp] ${outputName}`);
  await sharp(source).resize({ width, withoutEnlargement: true, kernel: sharp.kernel.lanczos3 }).webp({ quality: 90, effort: 5 }).toFile(output);
}

async function main() {
  await Promise.all([access(ffmpeg), access(sourceRoot)]);
  await mkdir(runtimeRoot, { recursive: true });
  await Promise.all([
    copyAlphaVideo("primul.webm", "pickup-first-alpha.webm"),
    copyAlphaVideo("aldoilea.webm", "pickup-second-alpha.webm"),
    copyAlphaVideo("video1.webm", "dropoff-alpha.webm"),
    background("flight laptop.jpeg", "flight-desktop.webp", 2400),
    background("flight mobil.jpeg", "flight-mobile.webp", 1440),
    background("drona final.png", "flight-drone-final-desktop.webp", 2400),
    background("drona final.png", "flight-drone-final-mobile.webp", 1440),
  ]);
  await Promise.all([
    alphaFrameSequence("primul.webm", "pickup-first-frames"),
    alphaFrameSequence("aldoilea.webm", "pickup-second-frames"),
    alphaFrameSequence("video1.webm", "dropoff-frames"),
  ]);
  await Promise.all([
    poster("primul.webm", "pickup-first-poster.webp", { alpha: true }),
    poster("aldoilea.webm", "pickup-second-poster.webp", { alpha: true }),
    poster("video1.webm", "dropoff-poster.webp", { alpha: true }),
    poster("video1.webm", "dropoff-end.webp", { end: true, alpha: true }),
  ]);
  console.log(`How-it-works media ready in ${runtimeRoot}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
