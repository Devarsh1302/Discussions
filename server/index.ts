import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ApiErrorResponse } from "../shared/types";
import { env, isProduction } from "./config/env";
import { healthcheck } from "./db/pool";
import { HttpError } from "./lib/http";
import { DiscussionRepository } from "./repositories/discussionRepository";
import { InMemoryDiscussionRepository } from "./repositories/inMemoryDiscussionRepository";
import { createDiscussionsRouter, createMessagesRouter } from "./routes/discussions";
import { createUsersRouter } from "./routes/users";
import { DiscussionService } from "./services/discussionService";
import { PhaseFinalizer } from "./services/phaseFinalizer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveRootDir(startDir: string) {
  const candidates = [
    startDir,
    path.resolve(startDir, ".."),
    path.resolve(startDir, "..", "..")
  ];

  return (
    candidates.find(
      (candidate) =>
        existsSync(path.join(candidate, "package.json")) &&
        existsSync(path.join(candidate, "index.html"))
    ) ?? path.resolve(startDir, "..")
  );
}

const rootDir = resolveRootDir(__dirname);
const app = express();
const usingInMemoryStore = !env.databaseUrl;
const repository = usingInMemoryStore ? new InMemoryDiscussionRepository() : new DiscussionRepository();
const finalizer = new PhaseFinalizer(repository);
const discussionService = new DiscussionService(repository, finalizer);

finalizer.start();

app.use(express.json({ limit: "1mb" }));
app.use((request, response, next) => {
  const origin = request.get("origin");
  const allowedOrigins = env.corsOrigins;

  if (origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin))) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }

  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");

  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }

  next();
});

app.get("/api/health", async (_request, response) => {
  try {
    const ok = usingInMemoryStore ? true : await healthcheck();
    response.json({ ok, storage: usingInMemoryStore ? "memory" : "postgres" });
  } catch {
    response.status(503).json({ ok: false, storage: usingInMemoryStore ? "memory" : "postgres" });
  }
});

app.use("/api/users", createUsersRouter(discussionService));
app.use("/api/discussions", createDiscussionsRouter(discussionService));
app.use("/api/messages", createMessagesRouter(discussionService));

app.use(
  (error: unknown, _request: Request, response: Response<ApiErrorResponse>, _next: NextFunction) => {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    const message =
      error instanceof Error ? error.message : "Something went wrong while handling the request.";

    if (statusCode >= 500) {
      console.error(error);
    }

    response.status(statusCode).json({ error: message });
  }
);

async function start() {
  if (isProduction) {
    const clientDist = path.resolve(rootDir, "dist", "client");
    app.use(express.static(clientDist));

    app.get("*", (_request, response) => {
      response.sendFile(path.join(clientDist, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: rootDir,
      appType: "custom",
      server: {
        middlewareMode: true
      }
    });

    app.use(vite.middlewares);

    app.use("*", async (request, response, next) => {
      try {
        const template = await readFile(path.resolve(rootDir, "index.html"), "utf8");
        const html = await vite.transformIndexHtml(request.originalUrl, template);
        response.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (error) {
        vite.ssrFixStacktrace(error as Error);
        next(error);
      }
    });
  }

  app.listen(env.port, () => {
    console.log(
      `Discussions API listening on http://localhost:${env.port} (${usingInMemoryStore ? "memory" : "postgres"} mode)`
    );
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
