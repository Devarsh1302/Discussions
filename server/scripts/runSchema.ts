import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "../db/pool";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const schemaPath = path.resolve(__dirname, "..", "db", "schema.sql");
  const sql = await readFile(schemaPath, "utf8");
  const pool = getPool();

  await pool.query(sql);
  await pool.end();

  console.log("Insight Discussions schema applied successfully.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
