// Prisma configuration file
// When prisma.config.ts is present, Prisma skips auto-loading .env files.
// We load them explicitly here so env vars are available for migrations.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    // These will be read from the schema file's env() references
    // We provide fallback empty strings to allow prisma generate to run
    url: process.env.DATABASE_URL || "postgresql://placeholder",
    directUrl: process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://placeholder",
  },
});
