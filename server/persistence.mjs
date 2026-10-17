import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
export function filePersistence(dir) {
  return {
    async load() {
      try {
        return JSON.parse(await readFile(join(dir, "vector.json"), "utf8"));
      } catch (e) {
        if (e.code === "ENOENT") return null;
        throw e;
      }
    },
    async save(value) {
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const tmp = join(dir, "vector.json.tmp");
      await writeFile(tmp, JSON.stringify(value), { mode: 0o600 });
      await rename(tmp, join(dir, "vector.json"));
    },
  };
}
export function storagePersistence(
  client,
  { component = "storage", node } = {},
) {
  return {
    load: () =>
      client.call(
        component + ".document_get",
        { namespace: "delta_vector", key: "state" },
        node,
      ),
    save: (value) =>
      client.call(
        component + ".document_put",
        { namespace: "delta_vector", key: "state", value },
        node,
      ),
  };
}
