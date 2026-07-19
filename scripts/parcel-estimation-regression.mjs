import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const nodeRequire = createRequire(import.meta.url);
const ts = nodeRequire("typescript");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const moduleCache = new Map();

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function assertRange(label, range, { minAtLeast, maxAtMost }) {
  assert(
    range && Number.isFinite(range.estimatedWeightMinKg),
    `${label}: missing deterministic weight range`,
  );
  assert(
    range.estimatedWeightMinKg >= minAtLeast,
    `${label}: expected min >= ${minAtLeast} kg, got ${range.estimatedWeightMinKg} kg`,
  );
  assert(
    range.estimatedWeightMaxKg <= maxAtMost,
    `${label}: expected max <= ${maxAtMost} kg, got ${range.estimatedWeightMaxKg} kg`,
  );
}

function resolveLocalFile(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

function resolveProjectImport(specifier, parentFilename) {
  if (specifier === "server-only") {
    return { type: "stub" };
  }

  if (specifier.startsWith("@/")) {
    const sourcePath = path.join(rootDir, "src", specifier.slice(2));
    const resolvedFile = resolveLocalFile(sourcePath);

    if (!resolvedFile) {
      fail(`Unable to resolve import ${specifier}`);
    }

    return { type: "file", filename: resolvedFile };
  }

  if (specifier.startsWith(".")) {
    const sourcePath = path.resolve(path.dirname(parentFilename), specifier);
    const resolvedFile = resolveLocalFile(sourcePath);

    if (!resolvedFile) {
      fail(`Unable to resolve import ${specifier} from ${parentFilename}`);
    }

    return { type: "file", filename: resolvedFile };
  }

  return { type: "external", specifier };
}

function loadProjectModule(filename) {
  const resolvedFilename = path.resolve(filename);
  const cached = moduleCache.get(resolvedFilename);

  if (cached) {
    return cached.exports;
  }

  const source = fs.readFileSync(resolvedFilename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: resolvedFilename,
  });
  const projectModule = new Module(resolvedFilename);

  projectModule.filename = resolvedFilename;
  projectModule.paths = Module._nodeModulePaths(path.dirname(resolvedFilename));
  moduleCache.set(resolvedFilename, projectModule);

  projectModule.require = (specifier) => {
    const resolved = resolveProjectImport(specifier, resolvedFilename);

    if (resolved.type === "stub") {
      return {};
    }

    if (resolved.type === "file") {
      return loadProjectModule(resolved.filename);
    }

    return nodeRequire(resolved.specifier);
  };

  projectModule._compile(transpiled.outputText, resolvedFilename);

  return projectModule.exports;
}

function loadSource(relativePath) {
  return loadProjectModule(path.join(rootDir, relativePath));
}

function assistantInput(contents, overrides = {}) {
  return {
    contents,
    category: "retail",
    packaging: "boxed",
    approximateSize: "small",
    ...overrides,
  };
}

function estimatorRequest(contentDescription, overrides = {}) {
  return {
    contentDescription,
    naturalDescription: {
      text: contentDescription,
      locale: "ro-RO",
      source: "customer",
      capturedAt: null,
    },
    advancedDetails: null,
    previousClarificationAnswers: [],
    category: "retail",
    packaging: "boxed",
    approximateSize: "small",
    currentFragileLevel: null,
    ...overrides,
  };
}

function mockOpenRouterEstimate(overrides = {}) {
  return {
    detectedItems: ["generic parcel"],
    detectedItemsDetailed: [],
    materials: ["mixed packaging"],
    packagingAssumption: "Standard parcel packaging.",
    packagingInference: {
      packagingType: "boxed",
      assumption: "Standard parcel packaging.",
      confidenceScore: 50,
      confidence: "medium",
      alternatives: [],
    },
    estimatedWeightMin: 0.5,
    estimatedWeightMax: 0.6,
    estimatedWeightRange: {
      minKg: 0.5,
      maxKg: 0.6,
      midpointKg: 0.55,
      label: "0.5 - 0.6 kg",
      source: "openrouter",
    },
    suggestedDimensionsCm: { lengthCm: 20, widthCm: 12, heightCm: 8 },
    estimatedDimensions: {
      dimensionsCm: { lengthCm: 20, widthCm: 12, heightCm: 8 },
      volumeLiters: 1.9,
      source: "openrouter",
      fitNotes: [],
    },
    volumeLiters: 1.9,
    category: "retail",
    confidenceScore: 86,
    confidence: "high",
    fragileLevel: "low",
    handlingNotes: [],
    weatherSensitivity: {
      rain: false,
      wind: false,
      heat: false,
      cold: false,
      humidity: false,
      notes: null,
    },
    riskFlags: [],
    clarificationQuestions: [],
    recommendedDroneClass: "light_swift",
    explanation: "OpenRouter low estimate used for regression safety.",
    ...overrides,
  };
}

const {
  buildBlockingProductClarifications,
  getDeterministicParcelWeightBounds,
  getLocalParcelAssistantResult,
  getSemanticParcelEstimate,
  parseLiquidVolumeLiters,
} = loadSource("src/lib/parcel-assistant.ts");

const liquidCases = [
  ["o sticla de plastic cu doi litri de apa", 2, 2.8],
  ["doza de cola de 350ml", 0.35, 0.7],
  ["doua doze de cola de 350 ml", 0.7, 1.1],
  ["2 doze cola 330 ml", 0.65, 1.05],
  ["3 sticle apa 500 ml", 1.5, 2.2],
  ["2 cans cola 330ml", 0.65, 1.05],
  ["o sticlă de 2 litri de apă", 2, 2.8],
  ["2 sticle de apă de 2L", 4, 5.2],
  ["două sticle de 500 ml apă", 1, 1.6],
  ["bidon de 5 litri apă", 5, 5.8],
];

for (const [description, minAtLeast, maxAtMost] of liquidCases) {
  const estimate = getSemanticParcelEstimate(assistantInput(description));
  const bounds = getDeterministicParcelWeightBounds(assistantInput(description));

  assertRange(description, estimate, { minAtLeast, maxAtMost });
  assert(
    bounds?.reason === "liquid_volume",
    `${description}: expected liquid physical bounds`,
  );
}

const emptyBottle = "sticlă goală de plastic";
const emptyBottleEstimate = getSemanticParcelEstimate(assistantInput(emptyBottle));

assert(
  parseLiquidVolumeLiters(emptyBottle) === null,
  "empty bottle should not parse as filled liquid volume",
);
assertRange(emptyBottle, emptyBottleEstimate, { minAtLeast: 0.05, maxAtMost: 0.6 });

const phoneEstimate = getSemanticParcelEstimate(
  assistantInput("iPhone 14 Pro Max în cutia originală, cu încărcător"),
);

assert(phoneEstimate, "iPhone parcel should have a semantic estimate");
assert(
  phoneEstimate.category === "electronics",
  `iPhone parcel should be electronics, got ${phoneEstimate?.category}`,
);
assert(
  phoneEstimate.estimatedWeightMinKg >= 0.4 &&
    phoneEstimate.estimatedWeightMaxKg <= 1.2,
  `iPhone parcel should stay in a realistic compact range, got ${phoneEstimate.estimatedWeightMinKg}-${phoneEstimate.estimatedWeightMaxKg} kg`,
);

const metalPartsEstimate = getSemanticParcelEstimate(
  assistantInput("cutie cu suruburi metalice"),
);
const clothesEstimate = getSemanticParcelEstimate(assistantInput("cutie cu haine"));

assert(metalPartsEstimate, "Metal hardware parcel should have a semantic estimate");
assert(clothesEstimate, "Clothing parcel should have a semantic estimate");
assert(
  metalPartsEstimate.estimatedWeightMinKg > clothesEstimate.estimatedWeightMinKg &&
    metalPartsEstimate.estimatedWeightMaxKg > clothesEstimate.estimatedWeightMaxKg,
  `Metal hardware should estimate heavier than clothes, got metal ${metalPartsEstimate.estimatedWeightMinKg}-${metalPartsEstimate.estimatedWeightMaxKg} kg and clothes ${clothesEstimate.estimatedWeightMinKg}-${clothesEstimate.estimatedWeightMaxKg} kg`,
);

const tshirtsEstimate = getSemanticParcelEstimate(assistantInput("3 tricouri"));

assertRange("3 tricouri", tshirtsEstimate, { minAtLeast: 0.4, maxAtMost: 1.3 });

const booksEstimate = getSemanticParcelEstimate(assistantInput("10 carti"));
const documentEnvelopeEstimate = getSemanticParcelEstimate(
  assistantInput("plic cu documente"),
);

assert(booksEstimate, "10 books should have a semantic estimate");
assert(documentEnvelopeEstimate, "Document envelope should have a semantic estimate");
assert(
  booksEstimate.estimatedWeightMinKg > documentEnvelopeEstimate.estimatedWeightMaxKg,
  `10 books should estimate heavier than an envelope, got books ${booksEstimate.estimatedWeightMinKg}-${booksEstimate.estimatedWeightMaxKg} kg and envelope ${documentEnvelopeEstimate.estimatedWeightMinKg}-${documentEnvelopeEstimate.estimatedWeightMaxKg} kg`,
);

const ceramicVaseEstimate = getSemanticParcelEstimate(assistantInput("vaza ceramica"));

assert(
  ceramicVaseEstimate?.fragileLevel === "high" &&
    ceramicVaseEstimate.estimatedWeightMinKg >= 0.3,
  `Ceramic vase should be fragile with realistic weight, got ${ceramicVaseEstimate?.fragileLevel} ${ceramicVaseEstimate?.estimatedWeightMinKg}-${ceramicVaseEstimate?.estimatedWeightMaxKg} kg`,
);

const computerEstimate = getSemanticParcelEstimate(assistantInput("calculator"));

assert(computerEstimate, "Calculator should have a semantic estimate");
assert(
  computerEstimate.category === "electronics",
  `Calculator should be electronics, got ${computerEstimate?.category}`,
);
assert(
  computerEstimate.estimatedWeightMinKg >= 4,
  `Calculator should use desktop-class weight before clarification, got ${computerEstimate.estimatedWeightMinKg}-${computerEstimate.estimatedWeightMaxKg} kg`,
);

const clarifiedLaptopSemanticEstimate = getSemanticParcelEstimate(
  assistantInput("calculator", {
    previousClarificationAnswers: [
      {
        questionId: "clarify_computer_type",
        field: "contents",
        answer: "laptop",
      },
    ],
  }),
);

assert(
  clarifiedLaptopSemanticEstimate?.detectedItems.includes("laptop"),
  `Laptop clarification should override generic calculator profile, got ${clarifiedLaptopSemanticEstimate?.detectedItems.join(", ")}`,
);
assert(
  clarifiedLaptopSemanticEstimate.estimatedWeightMaxKg < computerEstimate.estimatedWeightMinKg,
  `Laptop clarification should produce a lighter profile than desktop calculator, got laptop ${clarifiedLaptopSemanticEstimate.estimatedWeightMinKg}-${clarifiedLaptopSemanticEstimate.estimatedWeightMaxKg} kg and desktop ${computerEstimate.estimatedWeightMinKg}-${computerEstimate.estimatedWeightMaxKg} kg`,
);

const openRouter = loadSource("src/lib/ai/openrouter-parcel-estimator.ts");

openRouter.estimateParcelWithOpenRouter = async () => mockOpenRouterEstimate();

process.env.AI_PROVIDER = "openrouter";
process.env.OPENROUTER_API_KEY = "test-openrouter-key";

process.env.CLERK_SECRET_KEY = "test-clerk-secret";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-supabase-service-role";
process.env.STRIPE_SECRET_KEY = "test-stripe-secret";

const tavily = loadSource("src/lib/ai/tavily-product-lookup.ts");
const cannedIphoneResult = {
  title: "Apple iPhone 14 Pro Max specs",
  url: "https://www.apple.com/iphone-14-pro-max/",
  snippet: "iPhone 14 Pro Max, 240g, 6.7 inch display.",
  sourceType: "web",
  confidence: 0.85,
};
const tavilyStack = {
  mode: "auto",
  mockResults: [cannedIphoneResult],
  mockQueries: ["iphone 14 pro max"],
};
tavily.runProductLookupForEstimate = async () => {
  if (tavilyStack.mode === "nokey") {
    return {
      trace: {
        queries: [],
        results: [],
        skipped: true,
        reason: "no_api_key",
        usedInPrompt: false,
      },
      results: [],
    };
  }
  if (tavilyStack.mode === "mock") {
    return {
      trace: {
        queries: tavilyStack.mockQueries,
        results: tavilyStack.mockResults,
        skipped: false,
        reason: null,
        usedInPrompt: true,
      },
      results: tavilyStack.mockResults,
    };
  }
  return {
    trace: {
      queries: [],
      results: [],
      skipped: true,
      reason: "no_query",
      usedInPrompt: false,
    },
    results: [],
  };
};

const blockingIphone = buildBlockingProductClarifications(assistantInput("iphone"));
assert(
  blockingIphone.some(
    (question) =>
      question.blocksConfirmation === true &&
      /model/i.test(question.id) &&
      /iphone/i.test(question.id),
  ),
  `Bare "iphone" should produce a blocking model question, got ${JSON.stringify(blockingIphone.map((q) => q.id))}`,
);

const blockingIphoneKnown = buildBlockingProductClarifications(
  assistantInput("iPhone 14 Pro Max in cutie originala"),
);
assert(
  !blockingIphoneKnown.some((question) => /^clarify_iphone_model$/u.test(question.id)),
  `"iPhone 14 Pro Max" should not block on model (model known), got ${JSON.stringify(blockingIphoneKnown.map((q) => q.id))}`,
);

const blockingSamsungBare = buildBlockingProductClarifications(assistantInput("samsung"));
assert(
  blockingSamsungBare.some((question) => /phone/i.test(question.id)),
  `Bare "samsung" should produce a blocking phone question, got ${JSON.stringify(blockingSamsungBare.map((q) => q.id))}`,
);

const blockingSamsungS23 = buildBlockingProductClarifications(assistantInput("Samsung S23"));
assert(
  !blockingSamsungS23.some((question) => question.id === "clarify_phone_model"),
  `"Samsung S23" should not block on phone model (model known), got ${JSON.stringify(blockingSamsungS23.map((q) => q.id))}`,
);

const blockingLaptop = buildBlockingProductClarifications(assistantInput("laptop"));
assert(
  blockingLaptop.some((question) => question.id === "clarify_laptop_model") &&
    blockingLaptop.some((question) => question.id === "clarify_laptop_charger"),
  `Bare "laptop" should block on model and charger, got ${JSON.stringify(blockingLaptop.map((q) => q.id))}`,
);

const blockingPerfume100ml = buildBlockingProductClarifications(
  assistantInput("parfum 100ml"),
);
assert(
  !blockingPerfume100ml.some(
    (question) => question.id === "clarify_perfume_volume",
  ),
  `"parfum 100ml" should not block on volume (volume present), got ${JSON.stringify(blockingPerfume100ml.map((q) => q.id))}`,
);

const blockingMeds = buildBlockingProductClarifications(assistantInput("medicamente"));
assert(
  blockingMeds.some((question) => question.id === "clarify_meds_temperature"),
  `Bare "medicamente" should block on temperature, got ${JSON.stringify(blockingMeds.map((q) => q.id))}`,
);

const blockingVase = buildBlockingProductClarifications(assistantInput("vaza ceramica"));
assert(
  blockingVase.some((question) => /fragile/i.test(question.id)),
  `"vaza ceramica" without packaging detail should block on fragile packaging, got ${JSON.stringify(blockingVase.map((q) => q.id))}`,
);

const detect = tavily.detectProductLookupCandidates;
assert(
  detect("iPhone 14 Pro Max", []).some((q) => /iphone/i.test(q)),
  `iPhone 14 Pro Max should yield a lookup query, got ${JSON.stringify(detect("iPhone 14 Pro Max", []))}`,
);
assert(
  detect("Samsung S23", []).some((q) => /samsung/i.test(q)),
  `Samsung S23 should yield a lookup query, got ${JSON.stringify(detect("Samsung S23", []))}`,
);
assert(
  detect("telefon", []).length === 0,
  `Bare "telefon" should NOT trigger web lookup (it blocks instead), got ${JSON.stringify(detect("telefon", []))}`,
);
assert(
  detect("2 sticle apa 2L", []).length === 0,
  `Water bottles (no brand/model) should NOT trigger web lookup, got ${JSON.stringify(detect("2 sticle apa 2L", []))}`,
);

const { estimateParcelForDispatch } = loadSource(
  "src/lib/ai/parcel-estimator-provider.ts",
);
const { recommendDeliveryConfiguration } = loadSource(
  "src/lib/delivery-configuration-recommendation.ts",
);

const correctedSingleBottle = await estimateParcelForDispatch(
  estimatorRequest("o sticla de plastic cu doi litri de apa"),
);

assert(
  correctedSingleBottle.estimatedWeightMin >= 2 &&
    correctedSingleBottle.estimatedWeightMax <= 2.8,
  `OpenRouter low liquid estimate should be corrected, got ${correctedSingleBottle.estimatedWeightMin}-${correctedSingleBottle.estimatedWeightMax} kg`,
);
assert(
  correctedSingleBottle.confidence !== "high",
  "AI conflict with liquid physics should not keep high confidence",
);
assert(
  correctedSingleBottle.explanation.includes(
    "Estimarea a fost ajustată după volumul lichidului detectat.",
  ),
  "corrected liquid estimate should include adjustment note",
);
assert(
  correctedSingleBottle.corrections?.[0]?.code === "liquid_volume",
  "corrected liquid estimate should include structured liquid correction metadata",
);
assert(
  correctedSingleBottle.corrections?.[0]?.detectedVolumeLiters === 2,
  `corrected liquid metadata should include detected 2L volume, got ${correctedSingleBottle.corrections?.[0]?.detectedVolumeLiters}`,
);

const correctedTwoBottles = await estimateParcelForDispatch(
  estimatorRequest("2 sticle de apă de 2L"),
);

assert(
  correctedTwoBottles.estimatedWeightMin >= 4 &&
    correctedTwoBottles.estimatedWeightMax <= 5.2,
  `Two 2L water bottles should be corrected to a physical range, got ${correctedTwoBottles.estimatedWeightMin}-${correctedTwoBottles.estimatedWeightMax} kg`,
);
assert(
  correctedTwoBottles.recommendedDroneClass !== "light_swift" &&
    (correctedTwoBottles.recommendedDroneClass.startsWith("medium") ||
      correctedTwoBottles.recommendedDroneClass.startsWith("heavy")),
  `Corrected heavier parcel should require a medium/heavy class, got ${correctedTwoBottles.recommendedDroneClass}`,
);

const singleColaCan = await estimateParcelForDispatch(
  estimatorRequest("doza de cola de 350ml"),
);
const twoColaCans = await estimateParcelForDispatch(
  estimatorRequest("doua doze de cola de 350 ml"),
);

assert(
  singleColaCan.estimatedWeightMin >= 0.35 && singleColaCan.estimatedWeightMax <= 0.8,
  `Single 350ml cola can should stay near one can, got ${singleColaCan.estimatedWeightMin}-${singleColaCan.estimatedWeightMax} kg`,
);
assert(
  twoColaCans.estimatedWeightMin >= singleColaCan.estimatedWeightMin * 1.7,
  `Two 350ml cola cans should be materially heavier than one, got single ${singleColaCan.estimatedWeightMin}-${singleColaCan.estimatedWeightMax} kg and two ${twoColaCans.estimatedWeightMin}-${twoColaCans.estimatedWeightMax} kg`,
);
assert(
  twoColaCans.estimatedWeightMin >= 0.7 && twoColaCans.estimatedWeightMax <= 1.1,
  `Two 350ml cola cans should be near 0.7-1.1 kg, got ${twoColaCans.estimatedWeightMin}-${twoColaCans.estimatedWeightMax} kg`,
);

const clarifiedMetalBox = await estimateParcelForDispatch(
  estimatorRequest("cutie cu obiecte", {
    previousClarificationAnswers: [
      {
        questionId: "clarify-material",
        field: "contents",
        answer: "metal",
      },
    ],
  }),
);

assert(
  clarifiedMetalBox.estimatedWeightMin >= 0.9,
  `Material clarification 'metal' should make the parcel heavier, got ${clarifiedMetalBox.estimatedWeightMin}-${clarifiedMetalBox.estimatedWeightMax} kg`,
);

const clarifiedQuantity = await estimateParcelForDispatch(
  estimatorRequest("tricouri", {
    previousClarificationAnswers: [
      {
        questionId: "clarify-quantity",
        field: "contents",
        answer: 4,
      },
    ],
  }),
);

assert(
  clarifiedQuantity.estimatedWeightMin >= 0.45 &&
    clarifiedQuantity.estimatedWeightMax <= 1.6,
  `Quantity clarification should adjust clothing weight, got ${clarifiedQuantity.estimatedWeightMin}-${clarifiedQuantity.estimatedWeightMax} kg`,
);

const clarifiedWeight = await estimateParcelForDispatch(
  estimatorRequest("cutie cu obiecte", {
    previousClarificationAnswers: [
      {
        questionId: "clarify-weight",
        field: "weight",
        answer: "aproximativ 2 kg",
      },
    ],
  }),
);

assert(
  clarifiedWeight.estimatedWeightMin === 2 && clarifiedWeight.estimatedWeightMax === 2,
  `Explicit weight clarification should be authoritative, got ${clarifiedWeight.estimatedWeightMin}-${clarifiedWeight.estimatedWeightMax} kg`,
);

const clarifiedEmptyBottle = await estimateParcelForDispatch(
  estimatorRequest("sticla de 2L apa", {
    previousClarificationAnswers: [
      {
        questionId: "clarify-full-empty",
        field: "contents",
        answer: "gol",
      },
    ],
  }),
);

assert(
  clarifiedEmptyBottle.estimatedWeightMax <= 0.8,
  `Empty bottle clarification should remove liquid mass, got ${clarifiedEmptyBottle.estimatedWeightMin}-${clarifiedEmptyBottle.estimatedWeightMax} kg`,
);

const calculatorDispatchEstimate = await estimateParcelForDispatch(
  estimatorRequest("calculator"),
);

assert(
  calculatorDispatchEstimate.category === "electronics",
  `Calculator dispatch estimate should be electronics, got ${calculatorDispatchEstimate.category}`,
);
assert(
  calculatorDispatchEstimate.confidence !== "high",
  "Ambiguous one-word calculator should not keep high confidence",
);
assert(
  calculatorDispatchEstimate.clarificationQuestions?.some(
    (question) => question.id === "clarify_computer_type",
  ),
  "Ambiguous calculator should ask for desktop/laptop/accessories clarification",
);

const clarifiedLaptopDispatchEstimate = await estimateParcelForDispatch(
  estimatorRequest("calculator", {
    previousClarificationAnswers: [
      {
        questionId: "clarify_computer_type",
        field: "contents",
        answer: "laptop",
      },
    ],
  }),
);

assert(
  clarifiedLaptopDispatchEstimate.category === "electronics",
  `Laptop clarification should remain electronics, got ${clarifiedLaptopDispatchEstimate.category}`,
);
assert(
  clarifiedLaptopDispatchEstimate.estimatedWeightMax < calculatorDispatchEstimate.estimatedWeightMin,
  `Laptop clarification should recalculate weight below desktop profile, got laptop ${clarifiedLaptopDispatchEstimate.estimatedWeightMin}-${clarifiedLaptopDispatchEstimate.estimatedWeightMax} kg and desktop ${calculatorDispatchEstimate.estimatedWeightMin}-${calculatorDispatchEstimate.estimatedWeightMax} kg`,
);

const phoneConfiguration = recommendDeliveryConfiguration({
  confirmedWeightKg: 0.5,
  parcelDimensionsCm: { lengthCm: 20, widthCm: 12, heightCm: 6 },
  volumeLiters: 1.4,
  category: "electronics",
  packaging: "boxed",
  fragilityLevel: "moderate",
  temperatureSensitive: false,
  securitySensitive: false,
  routeDistanceKm: 5,
  urgency: "standard",
  riskFlags: [],
  contentSignals: ["telefon in cutie"],
});

assert(
  phoneConfiguration.selectedConfiguration?.id === "aer_secure",
  `Small electronics should prefer AER Secure, got ${phoneConfiguration.selectedConfiguration?.id}`,
);

const tshirtConfiguration = recommendDeliveryConfiguration({
  confirmedWeightKg: 0.7,
  parcelDimensionsCm: { lengthCm: 30, widthCm: 20, heightCm: 8 },
  volumeLiters: 4.8,
  category: "retail",
  packaging: "soft_pouch",
  fragilityLevel: "low",
  temperatureSensitive: false,
  securitySensitive: false,
  routeDistanceKm: 5,
  urgency: "standard",
  riskFlags: [],
  contentSignals: ["tricouri"],
});

assert(
  !tshirtConfiguration.selectedConfiguration?.id.includes("thermal"),
  `Non-thermal clothing should not prefer a thermal module, got ${tshirtConfiguration.selectedConfiguration?.id}`,
);

const pizzaConfiguration = recommendDeliveryConfiguration({
  confirmedWeightKg: 0.9,
  parcelDimensionsCm: { lengthCm: 30, widthCm: 25, heightCm: 8 },
  volumeLiters: 6,
  category: "food",
  packaging: "insulated",
  fragilityLevel: "moderate",
  temperatureSensitive: true,
  securitySensitive: false,
  routeDistanceKm: 5,
  urgency: "standard",
  riskFlags: [],
  contentSignals: ["pizza", "mancare calda"],
});

assert(
  pizzaConfiguration.selectedConfiguration?.id === "nova_thermal_medium",
  `Prepared food should still allow NOVA Thermal Medium, got ${pizzaConfiguration.selectedConfiguration?.id}`,
);

const explicitHeavyBox = await estimateParcelForDispatch(
  estimatorRequest("cutie de 15 kg"),
);

assert(
  explicitHeavyBox.estimatedWeightMin === 15 && explicitHeavyBox.estimatedWeightMax === 15,
  `Explicit 15 kg should override generic size, got ${explicitHeavyBox.estimatedWeightMin}-${explicitHeavyBox.estimatedWeightMax} kg`,
);
assert(
  explicitHeavyBox.estimatedWeightRange?.source === "user_declared",
  `Explicit kg should be marked user_declared, got ${explicitHeavyBox.estimatedWeightRange?.source}`,
);

const {
  defaultCreateDeliveryParcelDraft,
  validateCreateDeliveryParcel,
} = loadSource("src/lib/create-delivery-parcel.ts");
const overweightValidation = validateCreateDeliveryParcel({
  ...defaultCreateDeliveryParcelDraft,
  contentDescription: "cutie de 15 kg",
  weightKg: 15,
  lengthCm: 30,
  widthCm: 20,
  heightCm: 10,
  intelligence: {
    status: "confirmed",
    estimate: null,
    confirmation: null,
    confirmedProfile: {},
  },
  confirmedProfile: {},
});

assert(
  !overweightValidation.isValid,
  "confirmed 15 kg parcel should be rejected by existing overweight validation",
);
assert(
  overweightValidation.weightMessage.includes("limita"),
  `overweight validation should mention fleet limit, got: ${overweightValidation.weightMessage}`,
);


tavilyStack.mode = "mock";
tavilyStack.mockResults = [cannedIphoneResult];
tavilyStack.mockQueries = ["iphone 14 pro max"];
const iphoneWithBox = await estimateParcelForDispatch(
  estimatorRequest("iPhone 14 Pro Max in cutie originala"),
);
assert(
  iphoneWithBox.lookupTrace,
  "iPhone estimate should carry a lookupTrace",
);
assert(
  iphoneWithBox.lookupTrace.skipped === false,
  `mocked lookup should not be skipped, got reason ${iphoneWithBox.lookupTrace.reason}`,
);
assert(
  iphoneWithBox.lookupTrace.results.length > 0 &&
    iphoneWithBox.lookupTrace.results[0].sourceType === "web" &&
    typeof iphoneWithBox.lookupTrace.results[0].confidence === "number",
  "lookupTrace results should be normalized with sourceType=web + numeric confidence",
);
assert(
  iphoneWithBox.estimatedWeightMin >= 0.3 &&
    iphoneWithBox.estimatedWeightMax <= 1.2,
  `iPhone 14 Pro Max in box should have realistic weight, got ${iphoneWithBox.estimatedWeightMin}-${iphoneWithBox.estimatedWeightMax} kg`,
);
assert(
  (iphoneWithBox.detectedItemsDetailed ?? []).some(
    (item) =>
      (item.sourceUrls && item.sourceUrls.length > 0) ||
      (item.lookupEvidence && item.lookupEvidence.length > 0),
  ),
  "a detected item should carry web source evidence after lookup",
);

tavilyStack.mode = "nokey";
const tavilyUnavailable = await estimateParcelForDispatch(
  estimatorRequest("iPhone 14 Pro Max in cutie originala"),
);
assert(
  tavilyUnavailable.lookupTrace?.skipped === true &&
    tavilyUnavailable.lookupTrace?.reason === "no_api_key",
  `Tavily unavailable should skip with no_api_key reason, got ${JSON.stringify(tavilyUnavailable.lookupTrace?.reason)}`,
);
assert(
  tavilyUnavailable.estimatedWeightMin >= 0.3 &&
    tavilyUnavailable.estimatedWeightMax <= 1.2,
  `iPhone estimate should still be realistic without Tavily, got ${tavilyUnavailable.estimatedWeightMin}-${tavilyUnavailable.estimatedWeightMax} kg`,
);
assert(
  (tavilyUnavailable.detectedItemsDetailed ?? []).every(
    (item) => !item.sourceUrls || item.sourceUrls.length === 0,
  ),
  "no item should carry web evidence when Tavily is unavailable",
);

tavilyStack.mode = "auto";
const bareIphone = await estimateParcelForDispatch(estimatorRequest("iphone"));
assert(
  bareIphone.clarificationQuestions?.some(
    (question) =>
      question.blocksConfirmation === true && /model/i.test(question.id),
  ),
  `bare "iphone" dispatch estimate should block on model, got ${JSON.stringify(bareIphone.clarificationQuestions?.map((q) => q.id))}`,
);

tavilyStack.mode = "mock";
const clarifiedIphone = await estimateParcelForDispatch(
  estimatorRequest("iphone", {
    previousClarificationAnswers: [
      {
        questionId: "clarify_iphone_model",
        field: "contents",
        answer: "iPhone 14 Pro Max",
      },
    ],
  }),
);
assert(
  !clarifiedIphone.clarificationQuestions?.some(
    (question) => /^clarify_iphone_model$/u.test(question.id),
  ),
  `clarified iPhone model should no longer block on model, got ${JSON.stringify(clarifiedIphone.clarificationQuestions?.map((q) => q.id))}`,
);
assert(
  clarifiedIphone.estimatedWeightMin >= 0.3 &&
    clarifiedIphone.estimatedWeightMax <= 1.2,
  `clarified iPhone estimate should remain realistic, got ${clarifiedIphone.estimatedWeightMin}-${clarifiedIphone.estimatedWeightMax} kg`,
);
assert(
  clarifiedIphone.lookupTrace?.results.length > 0,
  "clarified iPhone estimate should populate lookup trace via mock",
);

tavilyStack.mode = "auto";

console.log("Parcel estimation regression checks passed.");
