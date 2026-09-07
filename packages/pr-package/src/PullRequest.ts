import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";

export interface PullRequestRef {
  owner: string;
  repo: string;
  number: number;
}

export type PullRequestState = "open" | "closed" | "unknown";

const OWNER_REPO = /^[A-Za-z0-9_.-]+$/;

/**
 * Parse `Alchemy-Pull-Request`. Returns `undefined` when the header is
 * absent, `"invalid"` when it is present but malformed.
 *
 * Accepted forms: `owner/repo#123`, `owner/repo/123`,
 * `https://github.com/owner/repo/pull/123`.
 */
export const parsePullRequest = (
  raw: string | undefined,
): PullRequestRef | undefined | "invalid" => {
  if (raw === undefined) return undefined;
  const value = raw.trim();
  if (value.length === 0) return undefined;

  const match =
    value.match(
      /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/i,
    ) ??
    value.match(/^([^/#]+)\/([^/#]+)#(\d+)$/) ??
    value.match(/^([^/#]+)\/([^/#]+)\/(\d+)$/);
  if (!match) return "invalid";

  const owner = match[1]!;
  const repo = match[2]!;
  const number = Number(match[3]);
  if (
    !OWNER_REPO.test(owner) ||
    !OWNER_REPO.test(repo) ||
    !Number.isSafeInteger(number) ||
    number <= 0
  ) {
    return "invalid";
  }
  return { owner, repo, number };
};

export const formatPullRequest = (pr: PullRequestRef) =>
  `${pr.owner}/${pr.repo}#${pr.number}`;

/** Renew TTL when a tarball is PR-tied and GitHub has not confirmed closed. */
export const shouldRenewOnTtl = (
  tiedToPullRequest: boolean,
  state: PullRequestState,
): boolean => tiedToPullRequest && state !== "closed";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Best-effort GitHub pull-request state. Network errors, rate limits, and
 * private/missing repos return `"unknown"` so a TTL handler can fail closed
 * (renew) instead of deleting a still-open preview.
 */
export const pullRequestState = (
  pr: PullRequestRef,
): Effect.Effect<PullRequestState> =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.execute(
      HttpClientRequest.get(
        `https://api.github.com/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}`,
      ).pipe(
        HttpClientRequest.setHeader(
          "User-Agent",
          "alchemy-pr-package (https://github.com/alchemy-run/alchemy)",
        ),
        HttpClientRequest.setHeader("Accept", "application/vnd.github+json"),
        HttpClientRequest.setHeader("X-GitHub-Api-Version", "2022-11-28"),
      ),
    );
    if (response.status !== 200) return "unknown" as const;
    const body: unknown = yield* response.json;
    if (!isRecord(body)) return "unknown" as const;
    if (body.state === "closed") return "closed" as const;
    if (body.state === "open") return "open" as const;
    return "unknown" as const;
  }).pipe(
    Effect.provide(FetchHttpClient.layer),
    Effect.catchCause(() => Effect.succeed("unknown" as const)),
  );
