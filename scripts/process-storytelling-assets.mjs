import { spawn } from "node:child_process";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const sourceRoot = path.join(projectRoot, "public", "assets", "storytelling");
const runtimeRoot = path.join(sourceRoot, "runtime");
const publicRuntimeRoot = "/assets/storytelling/runtime";

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
const verifyOnly = process.argv.includes("--verify-only");
const imagesOnly = process.argv.includes("--images-only");
const maxParallel = Math.max(
  1,
  Math.min(4, Number.parseInt(process.env.SKYSEND_MEDIA_JOBS ?? "2", 10) || 2),
);

const mobileCrop = "crop=608:1080:656:0,scale=1080:1920:flags=lanczos,setsar=1";
const posterRoot = path.join(runtimeRoot, "posters");
const runtimeImageRoot = path.join(runtimeRoot, "images");
const verificationRoot = path.join(runtimeRoot, "verification");
const temporaryRoot = path.join(runtimeRoot, ".tmp");

const scrubAssets = [
  {
    id: "hero",
    desktopSource: "videos/desktop/videosdesktopSV-H01-hero-city-crossing.mp4",
    mobileSource: "videos/mobile/SV-H01-hero-city-crossing-mobile.mp4",
    desktopFilename: "SV-H01-hero-city-crossing-scrub.mp4",
    mobileFilename: "SV-H01-hero-city-crossing-mobile-scrub.mp4",
    posterFraction: 0.32,
  },
  {
    id: "weather-rain",
    desktopSource: "videos/desktop/BGV-W01-rain.mp4",
    desktopFilename: "BGV-W01-rain-scrub.mp4",
    mobileFilename: "BGV-W01-rain-mobile-scrub.mp4",
    mobileFromDesktop: true,
    posterFraction: 0.48,
  },
  {
    id: "weather-clear",
    desktopSource: "videos/desktop/BGV-W02-clear.mp4",
    desktopFilename: "BGV-W02-clear-scrub.mp4",
    mobileFilename: "BGV-W02-clear-mobile-scrub.mp4",
    mobileFromDesktop: true,
    posterFraction: 0.48,
  },
  {
    id: "weather-snow",
    desktopSource: "videos/desktop/BGV-W03-snow.mp4",
    desktopFilename: "BGV-W03-snow-scrub.mp4",
    mobileFilename: "BGV-W03-snow-mobile-scrub.mp4",
    mobileFromDesktop: true,
    posterFraction: 0.48,
  },
];

const alphaAssets = [
  {
    id: "lower-locker",
    source: "videos/source-chroma/desktop/SV-01-lower-locker-chroma.mp4",
    desktopFilename: "SV-01-lower-locker-alpha.webm",
    mobileFilename: "SV-01-lower-locker-mobile-alpha.webm",
    keyColor: "ED0DE2",
    similarity: 0.16,
    blend: 0.055,
    mobile: true,
    posterFraction: 0.72,
  },
  {
    id: "pickup-retract",
    source: "videos/source-chroma/desktop/SV-02-pickup-load-retract-chroma.mp4",
    desktopFilename: "SV-02-pickup-load-retract-alpha.webm",
    mobileFilename: "SV-02-pickup-load-retract-mobile-alpha.webm",
    keyColor: "E70ED2",
    similarity: 0.16,
    blend: 0.055,
    mobile: true,
    posterFraction: 0.55,
  },
  {
    id: "delivery-complete",
    source: "videos/source-chroma/desktop/SV-03-delivery-complete-chroma.mp4",
    desktopFilename: "SV-03-delivery-complete-alpha.webm",
    mobileFilename: "SV-03-delivery-complete-mobile-alpha.webm",
    keyColor: "EC0BE2",
    similarity: 0.16,
    blend: 0.055,
    mobile: true,
    posterFraction: 0.78,
  },
  {
    id: "locker-open",
    source: "videos/source-chroma/interactive/IV-01-locker-open-chroma.mp4",
    desktopFilename: "IV-01-locker-open-alpha.webm",
    keyColor: "EB6BB8",
    similarity: 0.15,
    blend: 0.05,
    mobile: false,
    posterFraction: 0.72,
  },
];

const cutoutImages = [
  { id: "payload-food", source: "images/payloads/IMG-C01-food.png", strategy: "global-key" },
  { id: "payload-pharmacy", source: "images/payloads/IMG-C02-pharmacy.png", strategy: "pharmacy-mask" },
  { id: "payload-electronics", source: "images/payloads/IMG-C03-electronics.png", strategy: "global-key" },
  { id: "rig-front", source: "images/product/IMG-P01-rig-front.png", strategy: "global-key" },
  { id: "rig-three-quarter", source: "images/product/IMG-P02-rig-three-quarter.png", strategy: "global-key" },
  { id: "drone-three-quarter", source: "images/product/IMG-P03-drone-three-quarter.png", strategy: "global-key" },
  { id: "locker-closed", source: "images/product/IMG-P04-locker-closed.png", strategy: "global-key" },
  { id: "locker-open", source: "images/product/IMG-P05-locker-open.png", strategy: "global-key" },
];

function absoluteSource(relativePath) {
  return path.join(sourceRoot, ...relativePath.split("/"));
}

function runtimePath(...parts) {
  return path.join(runtimeRoot, ...parts);
}

function publicPath(filePath) {
  return `${publicRuntimeRoot}/${path
    .relative(runtimeRoot, filePath)
    .split(path.sep)
    .join("/")}`;
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
      if (!capture && stderr.length > 16_000) stderr = stderr.slice(-16_000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(
        new Error(`${label} failed with exit code ${code}.\n${stderr.slice(-8_000)}`),
      );
    });
  });
}

async function runPool(tasks, limit = maxParallel) {
  const queue = [...tasks];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const task = queue.shift();
      await task();
    }
  });
  await Promise.all(workers);
}

async function probeVideo(filePath) {
  const raw = await run(
    ffprobe,
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=codec_name,width,height,pix_fmt,r_frame_rate,nb_frames:stream_tags=alpha_mode:format=duration,size,bit_rate",
      "-of",
      "json",
      filePath,
    ],
    `ffprobe ${path.basename(filePath)}`,
    { capture: true },
  );
  const parsed = JSON.parse(raw);
  const stream = parsed.streams?.[0] ?? {};
  const format = parsed.format ?? {};
  return {
    codec: stream.codec_name,
    width: Number(stream.width),
    height: Number(stream.height),
    pixelFormat: stream.pix_fmt,
    frameRate: stream.r_frame_rate,
    frameCount: Number(stream.nb_frames) || null,
    duration: Number(format.duration),
    bytes: Number(format.size),
    bitRate: Number(format.bit_rate) || null,
    alphaMode: stream.tags?.alpha_mode ?? stream.tags?.ALPHA_MODE ?? null,
  };
}

async function encodeScrub({ source, output, filter, label }) {
  if (!(await shouldBuild(source, output))) {
    console.log(`[skip] ${label}`);
    return;
  }
  await mkdir(path.dirname(output), { recursive: true });
  console.log(`[h264] ${label}`);
  const args = ["-hide_banner", "-loglevel", "error", "-y", "-i", source];
  if (filter) args.push("-vf", filter);
  args.push(
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
  );
  await run(ffmpeg, args, label);
}

function alphaFilter(asset, mobile = false) {
  const filters = [];
  if (mobile) filters.push(mobileCrop);
  filters.push(
    `chromakey=0x${asset.keyColor}:${asset.similarity}:${asset.blend}`,
    "format=yuva420p",
  );
  return filters.join(",");
}

async function encodeAlpha({ asset, source, output, mobile = false, label }) {
  if (!(await shouldBuild(source, output))) {
    console.log(`[skip] ${label}`);
    return;
  }
  await mkdir(path.dirname(output), { recursive: true });
  console.log(`[vp9-alpha] ${label}`);
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
      alphaFilter(asset, mobile),
      "-c:v",
      "libvpx-vp9",
      "-pix_fmt",
      "yuva420p",
      "-b:v",
      "0",
      "-crf",
      "24",
      "-deadline",
      "good",
      "-cpu-used",
      "5",
      "-row-mt",
      "1",
      "-tile-columns",
      mobile ? "1" : "2",
      "-frame-parallel",
      "1",
      "-g",
      "6",
      "-auto-alt-ref",
      "0",
      "-metadata:s:v:0",
      "alpha_mode=1",
      output,
    ],
    label,
  );
}

async function extractPoster({
  source,
  output,
  fraction,
  filter,
  alpha = false,
  label,
}) {
  if (!(await shouldBuild(source, output))) {
    console.log(`[skip] poster ${label}`);
    return;
  }
  const metadata = await probeVideo(source);
  const seek = Math.max(0, metadata.duration * fraction);
  const temporaryPng = path.join(
    temporaryRoot,
    `${path.basename(output, path.extname(output))}-${process.pid}.png`,
  );
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(temporaryRoot, { recursive: true });
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    seek.toFixed(3),
    "-i",
    source,
  ];
  if (filter) args.push("-vf", filter);
  args.push("-frames:v", "1", temporaryPng);
  console.log(`[poster] ${label}${alpha ? " (alpha)" : ""}`);
  await run(ffmpeg, args, `poster ${label}`);
  await sharp(temporaryPng)
    .webp({ quality: alpha ? 92 : 86, alphaQuality: 100, effort: 5 })
    .toFile(output);
}

function isBackgroundCandidate(red, green, blue) {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const chroma = maximum - minimum;
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  return luminance >= 230 && chroma <= 10;
}

async function removePharmacyCheckerboard(source, output, label) {
  if (!(await shouldBuild(source, output))) {
    console.log(`[skip] cutout ${label}`);
    return;
  }
  console.log(`[cutout/manual-mask] ${label}`);
  const metadata = await sharp(source).metadata();
  const width = metadata.width ?? 2048;
  const height = metadata.height ?? 2048;
  const mask = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 2048 2048">
      <defs><filter id="soft"><feGaussianBlur stdDeviation="1.2"/></filter></defs>
      <g fill="white" filter="url(#soft)">
        <path d="M700 395 C730 360 790 360 850 370 L1650 430 C1710 438 1745 474 1734 535 L1710 610 C1688 565 1660 548 1602 542 L758 486 C730 482 710 452 700 395 Z"/>
        <path d="M700 470 L1615 525 C1682 530 1702 570 1682 650 L1592 1465 C1585 1520 1545 1540 1490 1525 L715 1400 C675 1392 660 1360 666 1308 L650 650 C648 565 666 510 700 470 Z"/>
        <path d="M348 870 L560 830 L712 895 L712 1436 L530 1482 L350 1400 Z"/>
        <path d="M713 1010 C713 946 772 914 884 914 C996 914 1058 948 1058 1010 L1058 1512 C1058 1580 1002 1612 884 1612 C766 1612 713 1578 713 1512 Z"/>
        <path d="M1080 1138 L1330 1088 L1456 1158 L1456 1642 L1308 1704 L1080 1632 Z"/>
      </g>
    </svg>
  `);
  const coreMask = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 2048 2048">
      <defs><filter id="soft"><feGaussianBlur stdDeviation="1.2"/></filter></defs>
      <g fill="white" filter="url(#soft)">
        <path d="M735 406 C770 386 820 386 870 394 L1625 448 C1660 452 1682 470 1680 505 L1668 536 L760 475 C742 468 734 444 735 406 Z"/>
        <path d="M716 535 L1590 584 L1535 1436 L736 1355 L700 650 C698 590 704 552 716 535 Z"/>
        <path d="M374 894 L558 858 L682 910 L682 1412 L530 1450 L374 1382 Z"/>
        <path d="M742 1020 C742 972 790 948 884 948 C978 948 1028 974 1028 1020 L1028 1494 C1028 1550 982 1578 884 1578 C786 1578 742 1550 742 1494 Z"/>
        <path d="M1108 1162 L1324 1122 L1426 1176 L1426 1618 L1308 1668 L1108 1610 Z"/>
      </g>
    </svg>
  `);
  const [{ data: rgb, info }, { data: outer }, { data: core }] = await Promise.all([
    sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(mask, { density: 72 })
      .resize(width, height, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
    sharp(coreMask, { density: 72 })
      .resize(width, height, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ]);
  const rgba = Buffer.allocUnsafe(info.width * info.height * 4);
  for (let pixelIndex = 0; pixelIndex < info.width * info.height; pixelIndex += 1) {
    const sourceOffset = pixelIndex * 3;
    const destinationOffset = pixelIndex * 4;
    const red = rgb[sourceOffset];
    const green = rgb[sourceOffset + 1];
    const blue = rgb[sourceOffset + 2];
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const chroma = maximum - minimum;
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const keyed = isBackgroundCandidate(red, green, blue);
    const edgeAlpha = chroma <= 10 && luminance > 220
      ? Math.round(255 * Math.max(0, Math.min(1, (230 - luminance) / 10)))
      : 255;
    const globalAlpha = keyed ? 0 : edgeAlpha;
    const outerAlpha = outer[pixelIndex * 4 + 3];
    const coreAlpha = core[pixelIndex * 4 + 3];
    rgba[destinationOffset] = red;
    rgba[destinationOffset + 1] = green;
    rgba[destinationOffset + 2] = blue;
    rgba[destinationOffset + 3] = Math.round(
      (outerAlpha * Math.max(coreAlpha, globalAlpha)) / 255,
    );
  }
  await mkdir(path.dirname(output), { recursive: true });
  await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 2 })
    .resize({
      width: 1800,
      height: 1800,
      fit: "inside",
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(output);
}

async function removeBakedCheckerboard(source, output, label, strategy) {
  if (strategy === "pharmacy-mask") {
    await removePharmacyCheckerboard(source, output, label);
    return;
  }
  if (!(await shouldBuild(source, output))) {
    console.log(`[skip] cutout ${label}`);
    return;
  }
  console.log(`[cutout] ${label}`);
  const image = sharp(source).resize({
    width: 1800,
    height: 1800,
    fit: "inside",
    withoutEnlargement: true,
    kernel: sharp.kernel.lanczos3,
  });
  const { data, info } = await image
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixelCount = info.width * info.height;
  const rgba = Buffer.allocUnsafe(pixelCount * 4);
  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const sourceOffset = pixelIndex * 3;
    const destinationOffset = pixelIndex * 4;
    rgba[destinationOffset] = data[sourceOffset];
    rgba[destinationOffset + 1] = data[sourceOffset + 1];
    rgba[destinationOffset + 2] = data[sourceOffset + 2];
    const red = data[sourceOffset];
    const green = data[sourceOffset + 1];
    const blue = data[sourceOffset + 2];
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const chroma = maximum - minimum;
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const keyed = isBackgroundCandidate(red, green, blue);
    const edgeAlpha = chroma <= 10 && luminance > 220
      ? Math.round(255 * Math.max(0, Math.min(1, (230 - luminance) / 10)))
      : 255;
    rgba[destinationOffset + 3] = keyed ? 0 : edgeAlpha;
  }

  await mkdir(path.dirname(output), { recursive: true });
  await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 2 })
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(output);
}

async function createNavyComposite(source, output, layout, label) {
  if (!(await shouldBuild(source, output))) return;
  const canvas =
    layout === "mobile"
      ? { width: 720, height: 1280 }
      : layout === "square"
        ? { width: 900, height: 900 }
        : { width: 1280, height: 720 };
  const foreground = await sharp(source)
    .resize({
      width: canvas.width,
      height: canvas.height,
      fit: "contain",
      withoutEnlargement: true,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .png()
    .toBuffer();
  await mkdir(path.dirname(output), { recursive: true });
  await sharp({
    create: {
      ...canvas,
      channels: 4,
      background: { r: 5, g: 11, b: 20, alpha: 1 },
    },
  })
    .composite([{ input: foreground, gravity: "centre" }])
    .webp({ quality: 88, effort: 4 })
    .toFile(output);
  console.log(`[verify] navy composite ${label}`);
}

async function processScrubVideos() {
  const jobs = [];
  for (const asset of scrubAssets) {
    const desktopSource = absoluteSource(asset.desktopSource);
    const desktopOutput = runtimePath("videos", "desktop", asset.desktopFilename);
    const mobileSource = asset.mobileFromDesktop
      ? desktopSource
      : absoluteSource(asset.mobileSource);
    const mobileOutput = runtimePath("videos", "mobile", asset.mobileFilename);
    jobs.push(() =>
      encodeScrub({
        source: desktopSource,
        output: desktopOutput,
        label: `${asset.id} desktop`,
      }),
    );
    jobs.push(() =>
      encodeScrub({
        source: mobileSource,
        output: mobileOutput,
        filter: asset.mobileFromDesktop ? mobileCrop : undefined,
        label: `${asset.id} mobile${asset.mobileFromDesktop ? " mechanical crop" : " supplied source"}`,
      }),
    );
  }
  await runPool(jobs);
}

async function processAlphaVideos() {
  const jobs = [];
  for (const asset of alphaAssets) {
    const source = absoluteSource(asset.source);
    const desktopFolder = asset.mobile ? "desktop" : "interactive";
    const desktopOutput = runtimePath("videos", desktopFolder, asset.desktopFilename);
    jobs.push(() =>
      encodeAlpha({
        asset,
        source,
        output: desktopOutput,
        label: `${asset.id} ${desktopFolder}`,
      }),
    );
    if (asset.mobile) {
      const mobileOutput = runtimePath("videos", "mobile", asset.mobileFilename);
      jobs.push(() =>
        encodeAlpha({
          asset,
          source,
          output: mobileOutput,
          mobile: true,
          label: `${asset.id} mobile mechanical crop`,
        }),
      );
    }
  }
  await runPool(jobs);
}

async function processCutoutImages() {
  await runPool(
    cutoutImages.map((asset) => async () => {
      const source = absoluteSource(asset.source);
      const output = runtimePath(
        "images",
        `${path.basename(asset.source, path.extname(asset.source))}.webp`,
      );
      await removeBakedCheckerboard(source, output, asset.id, asset.strategy);
    }),
    1,
  );
}

async function processPosters() {
  const jobs = [];
  for (const asset of scrubAssets) {
    for (const layout of ["desktop", "mobile"]) {
      const filename = layout === "desktop" ? asset.desktopFilename : asset.mobileFilename;
      const source = runtimePath("videos", layout, filename);
      const output = runtimePath(
        "posters",
        `${path.basename(filename, path.extname(filename))}.webp`,
      );
      jobs.push(() =>
        extractPoster({
          source,
          output,
          fraction: asset.posterFraction,
          label: `${asset.id} ${layout}`,
        }),
      );
    }
  }
  for (const asset of alphaAssets) {
    const source = absoluteSource(asset.source);
    const layouts = asset.mobile ? ["desktop", "mobile"] : ["interactive"];
    for (const layout of layouts) {
      const filename =
        layout === "mobile" ? asset.mobileFilename : asset.desktopFilename;
      const output = runtimePath(
        "posters",
        `${path.basename(filename, path.extname(filename))}.webp`,
      );
      jobs.push(() =>
        extractPoster({
          source,
          output,
          fraction: asset.posterFraction,
          filter: alphaFilter(asset, layout === "mobile"),
          alpha: true,
          label: `${asset.id} ${layout}`,
        }),
      );
    }
  }
  await runPool(jobs);
}

async function processVerificationComposites() {
  const jobs = [];
  for (const asset of alphaAssets) {
    const layouts = asset.mobile ? ["desktop", "mobile"] : ["interactive"];
    for (const layout of layouts) {
      const filename =
        layout === "mobile" ? asset.mobileFilename : asset.desktopFilename;
      const source = runtimePath(
        "posters",
        `${path.basename(filename, path.extname(filename))}.webp`,
      );
      const output = runtimePath(
        "verification",
        `${asset.id}-${layout}-on-navy.webp`,
      );
      jobs.push(() =>
        createNavyComposite(
          source,
          output,
          layout === "interactive" ? "square" : layout,
          `${asset.id} ${layout}`,
        ),
      );
    }
  }
  for (const asset of cutoutImages) {
    const source = runtimePath(
      "images",
      `${path.basename(asset.source, path.extname(asset.source))}.webp`,
    );
    const output = runtimePath("verification", `${asset.id}-on-navy.webp`);
    jobs.push(() => createNavyComposite(source, output, "desktop", asset.id));
  }
  await runPool(jobs);
}

async function imageReport(filePath) {
  const [metadata, stats] = await Promise.all([
    sharp(filePath).metadata(),
    sharp(filePath).stats(),
  ]);
  const alphaChannel = metadata.hasAlpha ? stats.channels.at(-1) : undefined;
  return {
    src: publicPath(filePath),
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    hasAlpha: Boolean(metadata.hasAlpha),
    alphaMinimum: alphaChannel?.min ?? (metadata.hasAlpha ? null : 255),
    bytes: (await stat(filePath)).size,
  };
}

async function buildManifestAndReport() {
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    baseUrl: publicRuntimeRoot,
    cropPolicy: {
      nonHeroMobile: "mechanical center crop 608:1080, scaled to 1080:1920; no AI",
      heroMobile: "uses the supplied 1080x1920 mobile master",
    },
    scrub: {},
    alpha: {},
    images: {},
  };
  const report = {
    generatedAt: manifest.generatedAt,
    tools: { ffmpeg, ffprobe },
    settings: {
      scrub: "H.264, CRF 21, yuv420p, GOP/keyint 6, scenecut 0, faststart, no audio",
      alpha: "VP9 WebM, CRF 24, yuva420p, GOP 6, alpha_mode=1, no audio",
      cutouts:
        "edge-connected flood-fill of high-luminance low-saturation checkerboard pixels; max 1800 px",
    },
    warnings: [],
    files: [],
  };

  for (const asset of scrubAssets) {
    manifest.scrub[asset.id] = {};
    for (const layout of ["desktop", "mobile"]) {
      const filename = layout === "desktop" ? asset.desktopFilename : asset.mobileFilename;
      const video = runtimePath("videos", layout, filename);
      const poster = runtimePath(
        "posters",
        `${path.basename(filename, path.extname(filename))}.webp`,
      );
      const videoData = await probeVideo(video);
      const posterData = await imageReport(poster);
      manifest.scrub[asset.id][layout] = {
        src: publicPath(video),
        poster: publicPath(poster),
        width: videoData.width,
        height: videoData.height,
        duration: videoData.duration,
      };
      report.files.push({
        type: "scrub-video",
        id: asset.id,
        layout,
        src: publicPath(video),
        ...videoData,
      });
      report.files.push({ type: "poster", id: asset.id, layout, ...posterData });
    }
  }

  for (const asset of alphaAssets) {
    manifest.alpha[asset.id] = {};
    const layouts = asset.mobile ? ["desktop", "mobile"] : ["interactive"];
    for (const layout of layouts) {
      const filename =
        layout === "mobile" ? asset.mobileFilename : asset.desktopFilename;
      const video = runtimePath("videos", layout, filename);
      const poster = runtimePath(
        "posters",
        `${path.basename(filename, path.extname(filename))}.webp`,
      );
      const videoData = await probeVideo(video);
      const posterData = await imageReport(poster);
      const alphaDetected = videoData.alphaMode === "1" && posterData.hasAlpha;
      manifest.alpha[asset.id][layout] = {
        src: publicPath(video),
        poster: publicPath(poster),
        width: videoData.width,
        height: videoData.height,
        duration: videoData.duration,
      };
      report.files.push({
        type: "alpha-video",
        id: asset.id,
        layout,
        src: publicPath(video),
        alphaDetected,
        ...videoData,
      });
      report.files.push({ type: "alpha-poster", id: asset.id, layout, ...posterData });
      if (!alphaDetected) {
        report.warnings.push(
          `${asset.id}/${layout}: alpha could not be confirmed by both WebM alpha_mode and poster metadata.`,
        );
      }
    }
  }

  for (const asset of cutoutImages) {
    const output = runtimePath(
      "images",
      `${path.basename(asset.source, path.extname(asset.source))}.webp`,
    );
    const data = await imageReport(output);
    manifest.images[asset.id] = data.src;
    report.files.push({ type: "cutout-image", id: asset.id, ...data });
    if (!data.hasAlpha || data.alphaMinimum !== 0) {
      report.warnings.push(`${asset.id}: transparent background was not confirmed.`);
    }
  }

  await writeFile(
    runtimePath("storytelling-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    runtimePath("processing-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  return { manifest, report };
}

async function verifyInputs() {
  await Promise.all([access(ffmpeg), access(ffprobe), access(sourceRoot)]);
  const sources = [
    ...scrubAssets.flatMap((asset) => [
      absoluteSource(asset.desktopSource),
      ...(asset.mobileSource ? [absoluteSource(asset.mobileSource)] : []),
    ]),
    ...alphaAssets.map((asset) => absoluteSource(asset.source)),
    ...cutoutImages.map((asset) => absoluteSource(asset.source)),
  ];
  await Promise.all(sources.map((source) => access(source)));
}

async function main() {
  console.log(`Storytelling media pipeline (${maxParallel} concurrent encodes)`);
  console.log(`Output: ${runtimeRoot}`);
  await verifyInputs();
  await mkdir(runtimeRoot, { recursive: true });
  if (!verifyOnly) {
    if (!imagesOnly) {
      await processScrubVideos();
      await processAlphaVideos();
    }
    await processCutoutImages();
    if (!imagesOnly) await processPosters();
    await processVerificationComposites();
  }
  const { report } = await buildManifestAndReport();
  console.log(
    `Done: ${report.files.length} runtime files catalogued, ${report.warnings.length} warning(s).`,
  );
  if (report.warnings.length > 0) {
    for (const warning of report.warnings) console.warn(`[warning] ${warning}`);
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
