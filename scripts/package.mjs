import { readFile, writeFile, mkdir, readdir, cp, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { manifest, appManifest } from "../server/contract.mjs";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const files = [];
async function visit(dir) {
  for (const e of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await visit(p);
    else if (e.isFile()) {
      const b = await readFile(p);
      files.push({
        path: relative("dist", p).replaceAll("\\", "/"),
        sha256: sha(b),
        data: b.toString("base64"),
      });
    } else throw Error("Special file");
  }
}
await visit("dist");
await mkdir("release", { recursive: true });
const app = Buffer.from(
  JSON.stringify({ format: "delta-app-v1", manifest: appManifest, files }),
);
await writeFile("release/delta-vector.delta-app", app);
const stage = "release/stage";
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await cp("server", stage + "/server", { recursive: true });
await cp("dist", stage + "/dist", { recursive: true });
await cp("LICENSE", stage + "/LICENSE");
await cp("README.md", stage + "/README.md");
await writeFile(stage + "/manifest.json", JSON.stringify(manifest, null, 2));
const pkg = {
  name: "delta-vector-service",
  version: "0.1.0",
  type: "module",
  private: true,
  scripts: { start: "node server/main.mjs" },
};
await writeFile(stage + "/package.json", JSON.stringify(pkg));
await writeFile(
  stage + "/package-lock.json",
  JSON.stringify({
    name: pkg.name,
    version: pkg.version,
    lockfileVersion: 3,
    requires: true,
    packages: { "": pkg },
  }),
);
execFileSync("tar", ["-czf", "release/delta-vector.tar.gz", "-C", stage, "."]);
await writeFile(
  "release/plugin-manifest.json",
  JSON.stringify(manifest, null, 2),
);
await writeFile(
  "release/app-manifest.json",
  JSON.stringify(appManifest, null, 2),
);
await writeFile(
  "release/SHA256SUMS",
  sha(app) +
    "  delta-vector.delta-app\n" +
    sha(await readFile("release/delta-vector.tar.gz")) +
    "  delta-vector.tar.gz\n",
);
await rm(stage, { recursive: true, force: true });
console.log(
  "Packaged portable UI and process service, with SHA-256 checksums.",
);
