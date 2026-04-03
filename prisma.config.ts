import "dotenv/config";
import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./prisma/database-url.js";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx ts-node --project prisma/tsconfig.seed.json prisma/seed.ts",
  },
  datasource: {
    url: resolveDatabaseUrl(),
  },
});
