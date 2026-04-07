function toNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toOrigins(value: string | undefined) {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: toNumber(process.env.PORT, 3000),
  databaseUrl: process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? "",
  frontendUrl: process.env.FRONTEND_URL ?? "",
  corsOrigins: toOrigins(process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL)
};

export const isProduction = env.nodeEnv === "production";
