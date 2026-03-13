import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@fxflow/db", "@fxflow/shared", "@fxflow/types"],
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-libsql",
    "@libsql/client",
    "libsql",
  ],
}

export default nextConfig
