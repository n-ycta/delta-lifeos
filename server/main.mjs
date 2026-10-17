import { DeltaClient, servePlugin } from "./delta-sdk.mjs";
import { manifest } from "./contract.mjs";
import { createVector } from "./vector.mjs";
import { storagePersistence, filePersistence } from "./persistence.mjs";
const client = new DeltaClient();
// File mode is explicit for disposable development or standalone service deployment.
const persistence =
  process.env.VECTOR_STORAGE === "file"
    ? filePersistence(process.env.DATA_DIR || "data")
    : storagePersistence(client, {
        component: process.env.STORAGE_COMPONENT || "storage",
        node: process.env.STORAGE_NODE,
      });
await servePlugin(client, manifest, await createVector({ persistence }));
