import { DeltaClient, servePlugin } from "./delta-sdk.mjs";
import { manifest, capabilities } from "./contract.mjs";
import { createLifeOS } from "./lifeos.mjs";
import { storagePersistence, filePersistence } from "./persistence.mjs";
const client = new DeltaClient();
// File mode is explicit for disposable development or standalone service deployment.
const persistence =
  process.env.LIFEOS_STORAGE === "file"
    ? filePersistence(process.env.DATA_DIR || "data")
    : storagePersistence(client, {
        component: process.env.STORAGE_COMPONENT || "storage",
        node: process.env.STORAGE_NODE,
      });
const {resilientService}=await import('./lifecycle.mjs');const service=resilientService(capabilities,()=>createLifeOS({persistence}));const controller=new AbortController();for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{service.close();controller.abort()});await servePlugin(client,manifest,service.handlers,{signal:controller.signal});service.close();
