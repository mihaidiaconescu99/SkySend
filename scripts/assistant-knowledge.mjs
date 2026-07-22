import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, relative } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceFiles = [
  "docs/ai-assistant/knowledge-base.md",
  "docs/ai-assistant/faq.md",
  "docs/ai-assistant/policies.md",
];
const outputFile = "src/generated/assistant-knowledge.json";
const requiredFaqCategories = new Set([
  "general",
  "delivery",
  "handoff",
  "meeting-points",
  "parcels",
  "payments",
  "security",
  "tracking",
  "cancellations",
  "technical",
  "account",
  "support",
  "assistant-limits",
]);

function parseMetadata(line) {
  const match = line.match(/^@([a-z-]+):\s*(.*)$/u);
  return match ? [match[1], match[2].trim()] : null;
}

function splitList(value, separator) {
  return value
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

function finishRecord(records, current, source) {
  if (!current) return;
  const body = current.body.join("\n").trim();
  if (!body) throw new Error(`${source}: ${current.id} has no body.`);
  const category = current.metadata.category || current.inheritedCategory || "general";
  const kind = current.metadata.kind || (source.endsWith("faq.md") ? "faq" : "guide");
  const href = current.metadata.href || undefined;
  if (href && (!href.startsWith("/") || /\s/u.test(href))) {
    throw new Error(`${source}: ${current.id} has invalid href "${href}".`);
  }
  records.push({
    id: current.id,
    kind,
    category,
    title: current.title,
    aliases: splitList(current.metadata.aliases || "", "|"),
    keywords: splitList(current.metadata.keywords || "", ","),
    body,
    ...(href ? { href } : {}),
    source,
  });
}

function parseDocument(source, markdown) {
  const records = [];
  const lines = markdown.replace(/\r\n/gu, "\n").split("\n");
  const recordLevel = source.endsWith("faq.md") ? 3 : 2;
  let inheritedCategory = "general";
  let current = null;

  for (const line of lines) {
    const categoryHeading = line.match(/^##\s+([^\[].*)$/u);
    if (recordLevel === 3 && categoryHeading) {
      inheritedCategory = categoryHeading[1].trim();
      continue;
    }

    const heading = line.match(new RegExp(`^#{${recordLevel}} \\[([^\\]]+)\\] (.+)$`, "u"));
    if (heading) {
      finishRecord(records, current, source);
      current = {
        id: heading[1].trim(),
        title: heading[2].trim(),
        inheritedCategory,
        metadata: {},
        body: [],
      };
      continue;
    }

    if (!current) continue;
    const metadata = parseMetadata(line);
    if (metadata && current.body.every((item) => !item.trim())) {
      current.metadata[metadata[0]] = metadata[1];
      continue;
    }
    current.body.push(line);
  }

  finishRecord(records, current, source);
  return records;
}

async function buildIndex() {
  const documents = await Promise.all(
    sourceFiles.map(async (source) => ({
      source,
      markdown: await readFile(resolve(root, source), "utf8"),
    })),
  );
  const records = documents.flatMap(({ source, markdown }) =>
    parseDocument(source, markdown),
  );
  const ids = new Set();
  for (const record of records) {
    if (ids.has(record.id)) throw new Error(`Duplicate knowledge id: ${record.id}`);
    ids.add(record.id);
  }
  const faq = records.filter((record) => record.kind === "faq");
  if (faq.length < 50) throw new Error(`Expected at least 50 FAQ records, found ${faq.length}.`);
  const faqCategories = new Set(faq.map((record) => record.category));
  for (const category of requiredFaqCategories) {
    if (!faqCategories.has(category)) throw new Error(`Missing FAQ category: ${category}`);
  }
  return {
    version: 1,
    sources: sourceFiles,
    records,
  };
}

function serialize(index) {
  return `${JSON.stringify(index, null, 2)}\n`;
}

const command = process.argv[2] || "generate";
const index = await buildIndex();
const serialized = serialize(index);
const destination = resolve(root, outputFile);

if (command === "generate") {
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, serialized, "utf8");
  console.log(`Generated ${relative(root, destination)} with ${index.records.length} records.`);
} else if (command === "check") {
  const existing = await readFile(destination, "utf8").catch(() => "");
  if (existing !== serialized) {
    throw new Error(`${outputFile} is stale. Run npm run knowledge:generate.`);
  }
  console.log(`Knowledge index is current (${index.records.length} records).`);
} else {
  throw new Error(`Unknown command: ${command}`);
}
