// Prisma configuration file
// Environment variables are loaded from .env files automatically by Prisma CLI
// During build on Vercel, the schema file itself handles env vars
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
