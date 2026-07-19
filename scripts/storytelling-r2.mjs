import {
  DeleteObjectsCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const storytellingRoot = path.join(projectRoot, "public", "assets", "storytelling");
const publicRoots = [path.join(storytellingRoot, "hero"), path.join(storytellingRoot, "runtime")];
const extraSourceRoot = path.join(projectRoot, "public", "assets", "story telling poze si video");
const releasePointerPath = path.join(projectRoot, "src", "lib", "storytelling-release.json");
const manifestDirectory = path.join(projectRoot, "media-manifests");
const immutableCacheControl = "public, max-age=31536000, immutable";
const mp4CacheControl = "private, no-store, max-age=0";
const publicReleasePolicy = "storytelling-r2-v1;mp4=no-store;other=immutable";
const uploadConcurrency = 8;
const verifyConcurrency = 16;

const contentTypes = new Map([
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".json", "application/json; charset=utf-8"],
  [".mp4", "video/mp4"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webm", "video/webm"],
  [".webp", "image/webp"],
]);

function posixPath(value) {
  return value.split(path.sep).join("/");
}

function requiredEnvironment() {
  const names = [
    "CLOUDFLARE_R2_MEDIA_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_MEDIA_SECRET_ACCESS_KEY",
    "CLOUDFLARE_R2_MEDIA_PUBLIC_BUCKET",
    "CLOUDFLARE_R2_MEDIA_SOURCE_BUCKET",
    "CLOUDFLARE_R2_MEDIA_ENDPOINT",
    "CLOUDFLARE_R2_MEDIA_PUBLIC_URL",
  ];
  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);

  return {
    accessKeyId: process.env.CLOUDFLARE_R2_MEDIA_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.CLOUDFLARE_R2_MEDIA_SECRET_ACCESS_KEY.trim(),
    publicBucket: process.env.CLOUDFLARE_R2_MEDIA_PUBLIC_BUCKET.trim(),
    sourceBucket: process.env.CLOUDFLARE_R2_MEDIA_SOURCE_BUCKET.trim(),
    endpoint: process.env.CLOUDFLARE_R2_MEDIA_ENDPOINT.trim().replace(/\/+$/u, ""),
    publicUrl: process.env.CLOUDFLARE_R2_MEDIA_PUBLIC_URL.trim().replace(/\/+$/u, ""),
  };
}

function createClient(config) {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

async function collectFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(absolutePath)));
    else if (entry.isFile()) files.push(absolutePath);
  }
  return files;
}

async function collectPublicPaths() {
  const paths = [];
  for (const root of publicRoots) paths.push(...(await collectFiles(root)));
  return paths;
}

async function collectSourcePaths() {
  const rootEntries = await readdir(storytellingRoot, { withFileTypes: true });
  const rootFiles = rootEntries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(storytellingRoot, entry.name));
  return [...rootFiles, ...(await collectFiles(extraSourceRoot))];
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function mapLimit(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

function contentTypeFor(filePath) {
  return contentTypes.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
}

async function describeFiles(filePaths, relativePathFor) {
  const sortedPaths = [...filePaths].sort((left, right) => left.localeCompare(right, "en"));
  const described = await mapLimit(sortedPaths, uploadConcurrency, async (filePath) => {
    const metadata = await stat(filePath);
    return {
      absolutePath: filePath,
      path: posixPath(relativePathFor(filePath)),
      size: metadata.size,
      sha256: await sha256File(filePath),
      contentType: contentTypeFor(filePath),
    };
  });
  return described.sort((left, right) => left.path.localeCompare(right.path, "en"));
}

function collectionHash(files, salt = "") {
  const hash = createHash("sha256");
  if (salt) {
    hash.update(salt);
    hash.update("\0");
  }
  for (const file of files) {
    hash.update(file.path);
    hash.update("\0");
    hash.update(String(file.size));
    hash.update("\0");
    hash.update(file.sha256);
    hash.update("\0");
  }
  return hash.digest("hex");
}

function utcDateId() {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

async function buildInventory() {
  const publicPaths = await collectPublicPaths();
  const sourcePaths = await collectSourcePaths();
  const publicFiles = await describeFiles(publicPaths, (filePath) =>
    path.relative(storytellingRoot, filePath),
  );
  const sourceFiles = await describeFiles(sourcePaths, (filePath) => {
    if (filePath.startsWith(`${extraSourceRoot}${path.sep}`)) {
      return path.join("reference", path.relative(extraSourceRoot, filePath));
    }
    return path.join("root", path.relative(storytellingRoot, filePath));
  });
  const publicHash = collectionHash(publicFiles, publicReleasePolicy);
  const sourceHash = collectionHash(sourceFiles);
  const dateId = utcDateId();
  return {
    releaseId: `${dateId}-${publicHash.slice(0, 12)}`,
    sourceArchiveId: `${dateId}-${sourceHash.slice(0, 12)}`,
    publicHash,
    sourceHash,
    publicFiles,
    sourceFiles,
  };
}

function totalBytes(files) {
  return files.reduce((sum, file) => sum + file.size, 0);
}

function publicObjectKey(releaseId, file) {
  return `releases/${releaseId}/assets/storytelling/${file.path}`;
}

function sourceObjectKey(sourceArchiveId, file) {
  return `archives/${sourceArchiveId}/storytelling/${file.path}`;
}

async function objectMatches(client, bucket, key, file, isPublic) {
  try {
    const existing = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return (
      Number(existing.ContentLength) === file.size &&
      existing.Metadata?.sha256 === file.sha256 &&
      existing.ContentType === file.contentType &&
      existing.CacheControl === expectedCacheControl(file, isPublic)
    );
  } catch (error) {
    const status = error.$metadata?.httpStatusCode;
    if (status === 404 || error.name === "NotFound" || error.name === "NoSuchKey") return false;
    throw error;
  }
}

function expectedCacheControl(file, isPublic) {
  if (!isPublic) return "private, no-store";
  return file.contentType === "video/mp4" ? mp4CacheControl : immutableCacheControl;
}

async function uploadCollection({ client, bucket, files, keyFor, isPublic, label }) {
  let uploaded = 0;
  let skipped = 0;
  let completed = 0;
  await mapLimit(files, uploadConcurrency, async (file) => {
    const key = keyFor(file);
    if (await objectMatches(client, bucket, key, file, isPublic)) {
      skipped += 1;
    } else {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: createReadStream(file.absolutePath),
          ContentLength: file.size,
          ContentType: file.contentType,
          CacheControl: expectedCacheControl(file, isPublic),
          StorageClass: "STANDARD",
          Metadata: { sha256: file.sha256 },
        }),
      );
      uploaded += 1;
    }
    completed += 1;
    if (completed % 25 === 0 || completed === files.length) {
      console.log(`${label}: ${completed}/${files.length} checked (${uploaded} uploaded, ${skipped} unchanged)`);
    }
  });
  return { uploaded, skipped };
}

function serializableFile(file) {
  return {
    path: file.path,
    size: file.size,
    sha256: file.sha256,
    contentType: file.contentType,
  };
}

async function writeManifests(config, inventory) {
  const pointer = {
    releaseId: inventory.releaseId,
    publicBaseUrl: config.publicUrl,
    assetCount: inventory.publicFiles.length,
    totalBytes: totalBytes(inventory.publicFiles),
    contentSha256: inventory.publicHash,
  };
  const manifest = {
    schemaVersion: 1,
    publicReleasePolicy,
    ...pointer,
    sourceArchiveId: inventory.sourceArchiveId,
    sourceCount: inventory.sourceFiles.length,
    sourceBytes: totalBytes(inventory.sourceFiles),
    sourceSha256: inventory.sourceHash,
    publicFiles: inventory.publicFiles.map(serializableFile),
    sourceFiles: inventory.sourceFiles.map(serializableFile),
  };
  await mkdir(manifestDirectory, { recursive: true });
  await writeFile(releasePointerPath, `${JSON.stringify(pointer, null, 2)}\n`, "utf8");
  await writeFile(
    path.join(manifestDirectory, `storytelling-${inventory.releaseId}.json`),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

async function readCurrentManifest() {
  const pointer = JSON.parse(await readFile(releasePointerPath, "utf8"));
  const manifestPath = path.join(manifestDirectory, `storytelling-${pointer.releaseId}.json`);
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

async function verifyRemoteObject(client, bucket, key, file, isPublic) {
  const remote = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (Number(remote.ContentLength) !== file.size) throw new Error(`Size mismatch: ${key}`);
  if (remote.Metadata?.sha256 !== file.sha256) throw new Error(`SHA-256 mismatch: ${key}`);
  if (remote.ContentType !== file.contentType) throw new Error(`Content-Type mismatch: ${key}`);
  if (remote.CacheControl !== expectedCacheControl(file, isPublic)) {
    throw new Error(`Cache-Control mismatch: ${key}`);
  }
}

async function verifyHttp(config, manifest) {
  let completed = 0;
  await mapLimit(manifest.publicFiles, verifyConcurrency, async (file) => {
    const key = publicObjectKey(manifest.releaseId, file);
    const response = await fetch(`${config.publicUrl}/${key}`, {
      method: "HEAD",
      headers: { Origin: "https://skysend.website", "Accept-Encoding": "identity" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${key}`);
    if (Number(response.headers.get("content-length")) !== file.size) {
      throw new Error(`HTTP Content-Length mismatch: ${key}`);
    }
    completed += 1;
    if (completed % 100 === 0 || completed === manifest.publicFiles.length) {
      console.log(`HTTP: ${completed}/${manifest.publicFiles.length} objects verified`);
    }
  });

  const sampleKey = publicObjectKey(manifest.releaseId, manifest.publicFiles[0]);
  const corsResponse = await fetch(`${config.publicUrl}/${sampleKey}`, {
    method: "HEAD",
    headers: { Origin: "https://skysend.website", "Accept-Encoding": "identity" },
  });
  const cors = corsResponse.headers.get("access-control-allow-origin");
  if (cors !== "*" && cors !== "https://skysend.website") {
    throw new Error(`CORS is not configured on the public bucket (received ${cors ?? "no header"})`);
  }

  const mp4Files = manifest.publicFiles.filter((file) => file.contentType === "video/mp4");
  for (const file of mp4Files) {
    const key = publicObjectKey(manifest.releaseId, file);
    let finalCacheStatus = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(`${config.publicUrl}/${key}`, {
        headers: { Range: "bytes=0-1", Origin: "https://skysend.website" },
      });
      if (response.status !== 206) {
        throw new Error(`MP4 range request returned ${response.status}: ${key}`);
      }
      if (!response.headers.get("content-range")?.startsWith("bytes 0-1/")) {
        throw new Error(`MP4 Content-Range is invalid: ${key}`);
      }
      finalCacheStatus = response.headers.get("cf-cache-status") ?? "";
      await response.body?.cancel();
    }
    if (finalCacheStatus.toUpperCase() === "HIT") {
      throw new Error(`MP4 is still cached at the Cloudflare edge: ${key}`);
    }
  }
  console.log(`HTTP range: ${mp4Files.length} MP4 files returned 206 without edge-cache HIT`);
}

async function verifyManifest(config, client, manifest) {
  await client.send(new HeadBucketCommand({ Bucket: config.publicBucket }));
  await client.send(new HeadBucketCommand({ Bucket: config.sourceBucket }));
  let publicCompleted = 0;
  await mapLimit(manifest.publicFiles, verifyConcurrency, async (file) => {
    await verifyRemoteObject(
      client,
      config.publicBucket,
      publicObjectKey(manifest.releaseId, file),
      file,
      true,
    );
    publicCompleted += 1;
    if (publicCompleted % 100 === 0 || publicCompleted === manifest.publicFiles.length) {
      console.log(`R2 public: ${publicCompleted}/${manifest.publicFiles.length} objects verified`);
    }
  });
  let sourceCompleted = 0;
  await mapLimit(manifest.sourceFiles, verifyConcurrency, async (file) => {
    await verifyRemoteObject(
      client,
      config.sourceBucket,
      sourceObjectKey(manifest.sourceArchiveId, file),
      file,
      false,
    );
    sourceCompleted += 1;
  });
  console.log(`R2 source: ${sourceCompleted}/${manifest.sourceFiles.length} objects verified`);
  await verifyHttp(config, manifest);
}

async function listAllObjects(client, bucket, prefix) {
  const objects = [];
  let continuationToken;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }),
    );
    objects.push(...(page.Contents ?? []));
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
}

async function pruneReleases(config, client, keep) {
  if (!Number.isInteger(keep) || keep < 1) throw new Error("--keep must be an integer greater than zero");
  const objects = await listAllObjects(client, config.publicBucket, "releases/");
  const releases = [...new Set(objects.flatMap((object) => object.Key?.split("/")[1] ?? []))].sort().reverse();
  const remove = releases.slice(keep);
  if (!remove.length) {
    console.log(`No releases to prune; ${releases.length} present, keeping ${keep}.`);
    return;
  }
  for (const releaseId of remove) {
    const keys = objects.flatMap((object) => object.Key?.startsWith(`releases/${releaseId}/`) ? [object.Key] : []);
    for (let index = 0; index < keys.length; index += 1_000) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: config.publicBucket,
          Delete: { Objects: keys.slice(index, index + 1_000).map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
    console.log(`Pruned release ${releaseId} (${keys.length} objects)`);
  }
}

async function upload() {
  const config = requiredEnvironment();
  const client = createClient(config);
  await client.send(new HeadBucketCommand({ Bucket: config.publicBucket }));
  await client.send(new HeadBucketCommand({ Bucket: config.sourceBucket }));
  console.log("Hashing storytelling media...");
  const inventory = await buildInventory();
  console.log(
    `Release ${inventory.releaseId}: ${inventory.publicFiles.length} public files, ${(
      totalBytes(inventory.publicFiles) /
      1024 /
      1024
    ).toFixed(2)} MB`,
  );
  console.log(
    `Source archive ${inventory.sourceArchiveId}: ${inventory.sourceFiles.length} files, ${(
      totalBytes(inventory.sourceFiles) /
      1024 /
      1024
    ).toFixed(2)} MB`,
  );
  await uploadCollection({
    client,
    bucket: config.publicBucket,
    files: inventory.publicFiles,
    keyFor: (file) => publicObjectKey(inventory.releaseId, file),
    isPublic: true,
    label: "Public release",
  });
  await uploadCollection({
    client,
    bucket: config.sourceBucket,
    files: inventory.sourceFiles,
    keyFor: (file) => sourceObjectKey(inventory.sourceArchiveId, file),
    isPublic: false,
    label: "Source archive",
  });
  await writeManifests(config, inventory);
  const manifest = await readCurrentManifest();
  await verifyManifest(config, client, manifest);
  console.log(`Release ${inventory.releaseId} uploaded and verified.`);
}

async function plan() {
  const inventory = await buildInventory();
  console.log(
    JSON.stringify(
      {
        releaseId: inventory.releaseId,
        publicFiles: inventory.publicFiles.length,
        publicBytes: totalBytes(inventory.publicFiles),
        publicSha256: inventory.publicHash,
        sourceArchiveId: inventory.sourceArchiveId,
        sourceFiles: inventory.sourceFiles.length,
        sourceBytes: totalBytes(inventory.sourceFiles),
        sourceSha256: inventory.sourceHash,
      },
      null,
      2,
    ),
  );
}

async function main() {
  const command = process.argv[2];
  if (command === "plan") return plan();
  const config = requiredEnvironment();
  const client = createClient(config);
  if (command === "upload") return upload();
  if (command === "verify") return verifyManifest(config, client, await readCurrentManifest());
  if (command === "prune") {
    const keepArgument = process.argv.find((argument) => argument.startsWith("--keep="));
    return pruneReleases(config, client, Number(keepArgument?.split("=")[1] ?? 3));
  }
  throw new Error("Usage: storytelling-r2.mjs <plan|upload|verify|prune [--keep=3]>");
}

await main();
