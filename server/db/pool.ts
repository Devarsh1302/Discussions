import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { env } from "../config/env";

type Queryable = Pool | PoolClient;

let pool: Pool | null = null;

function createPool() {
  if (!env.databaseUrl) {
    throw new Error(
      "DATABASE_URL (or SUPABASE_DB_URL) is required before the API can talk to Supabase Postgres."
    );
  }

  return new Pool({
    connectionString: env.databaseUrl,
    ssl: env.databaseUrl.includes("sslmode=disable")
      ? false
      : {
          rejectUnauthorized: false
        }
  });
}

export function getPool() {
  if (!pool) {
    pool = createPool();
  }

  return pool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
  client?: Queryable
) {
  const executor = client ?? getPool();
  return executor.query<T>(text, values);
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function healthcheck() {
  const result: QueryResult<{ ok: number }> = await query("SELECT 1 AS ok");
  return result.rows[0]?.ok === 1;
}
