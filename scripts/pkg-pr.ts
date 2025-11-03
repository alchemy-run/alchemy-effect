import { $ } from "bun";
import { readdir, readFile, writeFile } from "node:fs/promises";
import yaml from "yaml";

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const yamlContent = yaml.stringify({
  packages: pkg.workspaces.packages,
  catalog: pkg.workspaces.catalog,
});
await writeFile("pnpm-workspace.yaml", yamlContent, "utf8");

const exclude: string[] = [];

const packages = (await readdir("."))
  .filter((p) => p.startsWith("alchemy-effect"))
  .filter((p) => !exclude.includes(p))
  .map((p) => `./${p}`);

console.log(`bunx pkg-pr-new publish --pnpm ${packages.join(" ")}`);
await $`bunx pkg-pr-new publish --pnpm ${packages.join(" ")}`;
