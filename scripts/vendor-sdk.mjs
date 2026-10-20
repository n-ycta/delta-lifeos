// Snapshot the actual shared SDK, not a reimplementation. Run after reviewing Delta UI changes.
import { mkdtemp, mkdir, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
const ui = resolve(process.env.DELTA_UI_SOURCE || "../delta-ui"),
  temp = await mkdtemp(join(tmpdir(), "lifeos-sdk-"));
try {
  const dir = join(temp, "package");
  await mkdir(dir, { recursive: true });
  for (const name of [
    "src/sdk/client.ts",
    "src/sdk/icons.ts",
    "src/sdk/controls.ts",
    "src/sdk/styles.css",
    "src/styles/tokens.css",
    "src/styles/base.css",
    "src/styles/components.css",
    "src/ui/controls.css",
    "LICENSE",
    "docs/workbench/PHOSPHOR-LICENSE",
  ]) {
    await mkdir(join(dir, name, ".."), { recursive: true });
    await cp(join(ui, name), join(dir, name));
  }
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({
      name: "@delta/ui",
      version: "0.3.2-lifeos.1",
      type: "module",
      private: true,
      license: "Apache-2.0",
      description:
        "Local snapshot of the reviewed Delta UI SDK source; not a published SDK release",
      exports: {
        "./sdk/client": "./src/sdk/client.ts",
        "./sdk/icons": "./src/sdk/icons.ts",
        "./sdk/controls": "./src/sdk/controls.ts",
        "./sdk/styles.css": "./src/sdk/styles.css",
      },
      dependencies: { "@phosphor-icons/core": "^2.1.1" },
    }),
  );
  await writeFile(
    join(dir, "SNAPSHOT.md"),
    "Local packaging of actual Delta UI SDK source with the accompanying host patch. Not an official published @delta/ui release. See the handoff patches and verification report.\n",
  );
  await mkdir("vendor", { recursive: true });
  execFileSync("tar", [
    "-czf",
    resolve("vendor/delta-ui-sdk.tgz"),
    "-C",
    temp,
    "package",
  ]);
  console.log("Packaged reviewed shared SDK source snapshot.");
} finally {
  await rm(temp, { recursive: true, force: true });
}
