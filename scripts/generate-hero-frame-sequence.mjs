import { spawn } from "node:child_process";
import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const assetRoot = path.join(projectRoot, "public", "assets", "storytelling");
const outputRoot = path.join(assetRoot, "hero", "frames");
const toolRoot = path.join(
  process.env.LOCALAPPDATA ?? "C:\\Users\\diaco\\AppData\\Local",
  "Codex",
  "tools",
  "skysend-ffmpeg",
  "node_modules",
);
const ffmpeg =
  process.env.SKYSEND_FFMPEG ??
  path.join(toolRoot, "@ffmpeg-installer", "win32-x64", "ffmpeg.exe");
const ffprobe =
  process.env.SKYSEND_FFPROBE ??
  path.join(toolRoot, "@ffprobe-installer", "win32-x64", "ffprobe.exe");

const variants = [
  {
    id: "desktop",
    source: "hf_20260715_201557_c9f73402-c080-4e51-a74e-127a78d77f4d.mp4",
    width: 1440,
    height: 810,
    posterTime: 3.5,
  },
  {
    id: "mobile",
    source: "hf_20260715_202410_e2b6da46-660a-462f-adb4-7da8f2e1e741.mp4",
    width: 1080,
    height: 1920,
    posterTime: 3.5,
  },
];

function run(command, args, label, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      windowsHide: true,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`${label} failed with exit code ${code}. ${stderr}`));
    });
  });
}

async function probe(source) {
  const raw = await run(
    ffprobe,
    [
      "-v",
      "error",
      "-count_frames",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,r_frame_rate,nb_read_frames:format=duration",
      "-of",
      "json",
      source,
    ],
    `Probe ${path.basename(source)}`,
    true,
  );
  const parsed = JSON.parse(raw);
  const stream = parsed.streams?.[0] ?? {};
  return {
    width: Number(stream.width),
    height: Number(stream.height),
    frameRate: stream.r_frame_rate,
    frameCount: Number(stream.nb_read_frames),
    duration: Number(parsed.format?.duration),
  };
}

async function generateVariant(variant) {
  const source = path.join(assetRoot, variant.source);
  const variantRoot = path.join(outputRoot, variant.id);
  const frameRoot = path.join(variantRoot, "images");
  const outputPattern = path.join(frameRoot, "frame-%03d.webp");
  const poster = path.join(variantRoot, "poster.webp");
  await mkdir(frameRoot, { recursive: true });

  console.log(`[frames] ${variant.id}`);
  await run(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      source,
      "-map",
      "0:v:0",
      "-an",
      "-vf",
      `scale=${variant.width}:${variant.height}:flags=lanczos,setsar=1`,
      "-c:v",
      "libwebp",
      "-q:v",
      "84",
      "-compression_level",
      "6",
      "-preset",
      "photo",
      "-start_number",
      "0",
      outputPattern,
    ],
    `Extract ${variant.id} frames`,
  );

  await run(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      variant.posterTime.toFixed(3),
      "-i",
      source,
      "-frames:v",
      "1",
      "-vf",
      `scale=${variant.width}:${variant.height}:flags=lanczos,setsar=1`,
      "-c:v",
      "libwebp",
      "-q:v",
      "84",
      "-compression_level",
      "6",
      "-preset",
      "photo",
      poster,
    ],
    `Generate ${variant.id} poster`,
  );

  const metadata = await probe(source);
  const generatedFrames = (await readdir(frameRoot)).filter((file) => file.endsWith(".webp"));
  return {
    source: variant.source,
    width: variant.width,
    height: variant.height,
    sourceWidth: metadata.width,
    sourceHeight: metadata.height,
    duration: metadata.duration,
    frameRate: metadata.frameRate,
    frameCount: generatedFrames.length,
    expectedFrameCount: metadata.frameCount,
    framePath: `/assets/storytelling/hero/frames/${variant.id}/images/frame-{{index}}.webp`,
    poster: `/assets/storytelling/hero/frames/${variant.id}/poster.webp`,
  };
}

async function main() {
  await Promise.all([access(ffmpeg), access(ffprobe)]);
  const entries = await Promise.all(variants.map(generateVariant));
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    variants: Object.fromEntries(variants.map((variant, index) => [variant.id, entries[index]])),
  };
  await writeFile(
    path.join(outputRoot, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  console.log(`[done] ${entries.map((entry) => `${entry.frameCount} ${entry.framePath}`).join(", ")}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  });
