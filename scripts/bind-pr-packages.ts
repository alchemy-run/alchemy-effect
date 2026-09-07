#!/usr/bin/env bun
/**
 * Re-point a PR publish's tags with Alchemy-Pull-Request so the pr-package
 * worker renews TTL while the PR stays open.
 *
 * The publish action may not send that header yet; this step is the
 * repo-local contract until it does.
 */
type Package = {
  project: string;
  tags: string[];
};

type Plan = {
  packages: Package[];
};

const plan = JSON.parse(required("PLAN")) as Plan;
const host = process.env.PR_PACKAGE_HOST?.trim() || "pkg.ing";
const token = required("TOKEN");
const pullRequest = required("PULL_REQUEST");
const ttl = process.env.TTL?.trim() || "1 week";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function projectUrl(project: string): string {
  const path = project.split("/").map(encodeURIComponent).join("/");
  return `https://${host}/projects/${path}`;
}

async function tarballHash(
  project: string,
  tag: string,
): Promise<string | undefined> {
  const url = `${projectUrl(project)}/tags/${encodeURIComponent(tag)}`;
  for (let attempt = 0; attempt < 15; attempt++) {
    const response = await fetch(url, { redirect: "manual" });
    if (response.status === 302) {
      const location = response.headers.get("location") ?? "";
      const match = location.match(/\/packages\/([a-f0-9]{64})\/?$/);
      if (match) return match[1];
    }
    await Bun.sleep(1000);
  }
  return undefined;
}

for (const pkg of plan.packages) {
  const prTag = pkg.tags.find((tag) => /^pr-\d+$/.test(tag));
  if (!prTag) continue;

  const hash = await tarballHash(pkg.project, prTag);
  if (!hash) {
    throw new Error(
      `Could not resolve ${pkg.project} tag ${prTag} to a tarball`,
    );
  }

  const response = await fetch(`${projectUrl(pkg.project)}/tags`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Alchemy-Tags": JSON.stringify(pkg.tags),
      "Alchemy-Tarball-Hash": hash,
      "Alchemy-TTL": ttl,
      "Alchemy-Pull-Request": pullRequest,
    },
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Failed to bind ${pkg.project} to ${pullRequest}: ${response.status} ${response.statusText}${details ? `\n${details}` : ""}`,
    );
  }
  console.log(`Bound ${pkg.project} ${prTag} to ${pullRequest}`);
}
