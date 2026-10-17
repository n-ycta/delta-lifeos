// Integration-only adapter: runs the real Delta Storage file handlers without provisioning a database.
import { readFile } from "node:fs/promises";
import { fileHandlers } from "../../delta_db/server/file.mjs";
import { DeltaClient, servePlugin } from "../server/delta-sdk.mjs";
const manifest = JSON.parse(
  await readFile(new URL("../../delta_db/manifest.json", import.meta.url)),
);
const handlers = await fileHandlers(process.env.TEST_STORAGE_FILE);
await servePlugin(new DeltaClient(), manifest, handlers);
