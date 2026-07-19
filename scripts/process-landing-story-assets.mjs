import { spawn } from "node:child_process";
import { access, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const sourceRoot = path.join(projectRoot, "public", "assets", "storytelling");
const runtimeRoot = path.join(sourceRoot, "runtime", "landing");

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

const force = process.argv.includes("--force");
const editorialSource = path.join(
  sourceRoot,
  "hf_20260716_174407_1703a263-63a5-4254-ab7f-2e6e82e135c5.mp4",
);

const weatherAssets = [
  {
    id: "winter",
    desktopSource: "iarna video.mp4",
    mobileSource: "iarna video mobil.mp4",
  },
  {
    id: "sky",
    desktopSource: "cer video.mp4",
    mobileSource: "cer video mobil.mp4",
  },
  {
    id: "rain",
    desktopSource: "ploaie video.mp4",
    mobileSource: "ploaie video mobil.mp4",
  },
];

function run(command, args, label, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      windowsHide: true,
      stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "pipe"],
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
        resolve(stdout.trim());
        return;
      }
      reject(new Error(`${label} failed with exit code ${code}.\n${stderr.slice(-8000)}`));
    });
  });
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function shouldBuild(source, output) {
  if (force || !(await exists(output))) return true;
  const [sourceStats, outputStats] = await Promise.all([stat(source), stat(output)]);
  return outputStats.mtimeMs < sourceStats.mtimeMs;
}

async function durationOf(source) {
  const output = await run(
    ffprobe,
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      source,
    ],
    `probe ${path.basename(source)}`,
    { capture: true },
  );
  return Number(output);
}

async function encodeScrub(source, output, label) {
  if (!(await shouldBuild(source, output))) {
    console.log(`[skip] ${label}`);
    return;
  }
  await mkdir(path.dirname(output), { recursive: true });
  console.log(`[h264 scrub] ${label}`);
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
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "21",
      "-pix_fmt",
      "yuv420p",
      "-g",
      "6",
      "-keyint_min",
      "6",
      "-sc_threshold",
      "0",
      "-movflags",
      "+faststart",
      output,
    ],
    label,
  );
}

async function extractPoster(source, output, fraction, label, filter) {
  if (!(await shouldBuild(source, output))) {
    console.log(`[skip] ${label}`);
    return;
  }
  await mkdir(path.dirname(output), { recursive: true });
  const duration = await durationOf(source);
  const temporary = `${output}.png`;
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(Math.max(0, duration * fraction)),
    "-i",
    source,
    "-frames:v",
    "1",
  ];
  if (filter) args.push("-vf", filter);
  args.push(temporary);
  console.log(`[poster] ${label}`);
  await run(ffmpeg, args, label);
  await sharp(temporary)
    .webp({ quality: 88, alphaQuality: 100, effort: 5 })
    .toFile(output);
  await rm(temporary, { force: true });
}

async function extractEndPoster(source, output, label) {
  if (!(await shouldBuild(source, output))) {
    console.log(`[skip] ${label}`);
    return;
  }
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.png`;
  console.log(`[poster] ${label}`);
  await run(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-sseof",
      "-0.08",
      "-i",
      source,
      "-frames:v",
      "1",
      temporary,
    ],
    label,
  );
  await sharp(temporary)
    .webp({ quality: 90, alphaQuality: 100, effort: 5 })
    .toFile(output);
  await rm(temporary, { force: true });
}

async function encodeEditorialAlpha() {
  const source = editorialSource;
  const output = path.join(runtimeRoot, "video1-alpha.webm");
  if (!(await shouldBuild(source, output))) {
    console.log("[skip] editorial alpha video");
    return;
  }
  await mkdir(runtimeRoot, { recursive: true });
  console.log("[vp9 alpha] editorial video1");
  await run(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      source,
      "-vf",
      "colorkey=0x000000:0.025:0.035,format=yuva420p",
      "-map",
      "0:v:0",
      "-an",
      "-c:v",
      "libvpx-vp9",
      "-deadline",
      "good",
      "-cpu-used",
      "2",
      "-crf",
      "24",
      "-b:v",
      "0",
      "-pix_fmt",
      "yuva420p",
      "-g",
      "6",
      "-keyint_min",
      "6",
      "-auto-alt-ref",
      "0",
      "-metadata:s:v:0",
      "alpha_mode=1",
      output,
    ],
    "editorial video1 alpha",
  );
}

async function buildEditorialFrameSequence(layout) {
  const source = editorialSource;
  const outputDirectory = path.join(runtimeRoot, "video1-frames", layout);
  const marker = path.join(outputDirectory, "frame-0139.webp");
  if (!(await shouldBuild(source, marker))) {
    console.log(`[skip] editorial ${layout} frame sequence`);
    return;
  }

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  const temporaryDirectory = path.join(runtimeRoot, `.video1-${layout}-frames`);
  await rm(temporaryDirectory, { recursive: true, force: true });
  await mkdir(temporaryDirectory, { recursive: true });

  const filter =
    layout === "desktop"
      ? "colorkey=0x000000:0.025:0.035,format=rgba,scale=1920:-1:flags=lanczos"
      : "colorkey=0x000000:0.025:0.035,format=rgba,scale=1080:-1:flags=lanczos,pad=1080:1440:0:416:color=black@0";

  console.log(`[frames] editorial ${layout}`);
  await run(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      source,
      "-vf",
      filter,
      "-vsync",
      "0",
      path.join(temporaryDirectory, "frame-%04d.png"),
    ],
    `editorial ${layout} frame extraction`,
  );

  const files = (await readdir(temporaryDirectory))
    .filter((name) => name.endsWith(".png"))
    .sort();
  const batchSize = 8;
  for (let index = 0; index < files.length; index += batchSize) {
    await Promise.all(
      files.slice(index, index + batchSize).map(async (name) => {
      await sharp(path.join(temporaryDirectory, name))
        .webp({ quality: 94, alphaQuality: 100, effort: 4 })
        .toFile(path.join(outputDirectory, name.replace(/\.png$/, ".webp")));
      }),
    );
  }
  await rm(temporaryDirectory, { recursive: true, force: true });
}

async function buildLandingIllustrations() {
  const images = [
    ["drona final.png", "final-drone.webp", 2600],
  ];

  await Promise.all(
    images.map(async ([sourceName, outputName, width]) => {
      const source = path.join(sourceRoot, sourceName);
      const output = path.join(runtimeRoot, outputName);
      if (!(await shouldBuild(source, output))) {
        console.log(`[skip] ${outputName}`);
        return;
      }
      console.log(`[webp] ${outputName}`);
      await sharp(source)
        .resize({ width, withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
        .webp({ quality: 90, alphaQuality: 100, effort: 5 })
        .toFile(output);
    }),
  );
}

async function buildPartnerLogo(sourceName, outputName) {
  const source = path.join(sourceRoot, sourceName);
  const output = path.join(runtimeRoot, outputName);
  if (!(await shouldBuild(source, output))) {
    console.log(`[skip] ${outputName}`);
    return;
  }

  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const alpha = data[index + 3];
    const minimum = Math.min(red, green, blue);
    const maximum = Math.max(red, green, blue);
    if (minimum > 208 && maximum - minimum < 34) {
      const retained = Math.max(0, Math.min(1, (248 - minimum) / 40));
      data[index + 3] = Math.round(alpha * retained);
    }
  }

  console.log(`[logo] ${outputName}`);
  await sharp(data, { raw: info })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width: 720, height: 240, fit: "inside", kernel: sharp.kernel.lanczos3 })
    .webp({ quality: 92, alphaQuality: 100, effort: 5 })
    .toFile(output);
}

async function buildPartnerLogos() {
  await Promise.all([
    buildPartnerLogo("uber eats.png", "partner-uber-eats.webp"),
    buildPartnerLogo("wolt.png", "partner-wolt.webp"),
    buildPartnerLogo("bolt food.png", "partner-bolt-food.webp"),
    buildPartnerLogo("sameday", "partner-sameday.webp"),
    buildPartnerLogo("glovo.png", "partner-glovo.webp"),
  ]);
}

async function buildLockerImages() {
  const images = [
    ["poza locker.png", "locker-shell.webp"],
    ["image0.png", "locker-content-winter.webp"],
    ["image1.png", "locker-content-sky.webp"],
    ["image2.png", "locker-content-rain.webp"],
  ];

  await Promise.all(
    images.map(async ([sourceName, outputName]) => {
      const source = path.join(sourceRoot, sourceName);
      const output = path.join(runtimeRoot, outputName);
      if (!(await shouldBuild(source, output))) {
        console.log(`[skip] ${outputName}`);
        return;
      }
      console.log(`[webp] ${outputName}`);
      await sharp(source)
        .resize({ width: 1600, height: 1600, fit: "fill", kernel: sharp.kernel.lanczos3 })
        .webp({ quality: 90, alphaQuality: 100, effort: 5 })
        .toFile(output);
    }),
  );
}

async function main() {
  await Promise.all([access(ffmpeg), access(ffprobe), access(sourceRoot)]);
  await mkdir(runtimeRoot, { recursive: true });
  await encodeEditorialAlpha();
  await buildEditorialFrameSequence("desktop");
  await buildEditorialFrameSequence("mobile");
  await extractPoster(
    editorialSource,
    path.join(runtimeRoot, "video1-alpha.webp"),
    0.58,
    "editorial alpha fallback",
    "colorkey=0x000000:0.025:0.035,format=rgba",
  );
  await buildLandingIllustrations();
  await buildPartnerLogos();
  await buildLockerImages();

  for (const asset of weatherAssets) {
    for (const layout of ["desktop", "mobile"]) {
      const source = path.join(
        sourceRoot,
        layout === "desktop" ? asset.desktopSource : asset.mobileSource,
      );
      const output = path.join(runtimeRoot, `${asset.id}-${layout}-scrub.mp4`);
      await encodeScrub(source, output, `${asset.id} ${layout}`);
      const posterOutput =
        asset.id === "winter"
          ? path.join(runtimeRoot, `winter-first-frame-${layout}.webp`)
          : path.join(runtimeRoot, `${asset.id}-${layout}-poster.webp`);
      await extractPoster(
        output,
        posterOutput,
        asset.id === "winter" ? 0 : 0.48,
        `${asset.id} ${layout} poster`,
      );
      if (asset.id === "rain") {
        await extractEndPoster(
          output,
          path.join(runtimeRoot, `rain-${layout}-end.webp`),
          `rain ${layout} end poster`,
        );
      }
    }
  }

  console.log(`Landing media ready in ${runtimeRoot}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
