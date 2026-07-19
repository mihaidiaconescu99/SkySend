import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

function getLocalDevOrigins() {
  return Object.values(networkInterfaces()).flatMap((interfaces) =>
    (interfaces ?? [])
      .filter((networkInterface) => {
        return networkInterface.family === "IPv4" && !networkInterface.internal;
      })
      .map((networkInterface) => networkInterface.address),
  );
}

function getConfiguredDevOrigins() {
  return (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    ...new Set([
      "localhost",
      "127.0.0.1",
      ...getLocalDevOrigins(),
      ...getConfiguredDevOrigins(),
    ]),
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.skysend.website",
        pathname: "/releases/**",
      },
    ],
  },
  poweredByHeader: false,
};

export default nextConfig;
