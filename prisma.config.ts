import path from "node:path";
import { defineConfig } from "prisma/config";

/** Seed lives here; DB URL still comes from `schema.prisma` / env at runtime. */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "node prisma/seed.js",
  },
});
