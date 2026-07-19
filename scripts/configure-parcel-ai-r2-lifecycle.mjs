import { GetBucketLifecycleConfigurationCommand, PutBucketLifecycleConfigurationCommand, S3Client } from "@aws-sdk/client-s3";

const required = [
  "CLOUDFLARE_R2_ENDPOINT",
  "CLOUDFLARE_R2_BUCKET",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}

const client = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

let existingRules = [];
try {
  const existing = await client.send(new GetBucketLifecycleConfigurationCommand({ Bucket: process.env.CLOUDFLARE_R2_BUCKET }));
  existingRules = existing.Rules ?? [];
} catch {
  // No lifecycle configuration exists yet.
}
await client.send(new PutBucketLifecycleConfigurationCommand({
  Bucket: process.env.CLOUDFLARE_R2_BUCKET,
  LifecycleConfiguration: {
    Rules: [...existingRules.filter((rule) => rule.ID !== "parcel-ai-expire-after-one-day"), {
      ID: "parcel-ai-expire-after-one-day",
      Status: "Enabled",
      Filter: { Prefix: "parcel-ai/" },
      Expiration: { Days: 1 },
    }],
  },
}));

console.log("Configured R2 lifecycle for parcel-ai/ (1 day expiration).");
