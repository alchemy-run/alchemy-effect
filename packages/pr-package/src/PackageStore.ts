import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Bucket } from "./Bucket.ts";
import {
  pullRequestState,
  shouldRenewOnTtl,
  type PullRequestRef,
} from "./PullRequest.ts";
import { TagIndex } from "./TagIndex.ts";
import { tarballId, tarballKey, tarballRef } from "./Tarball.ts";

interface PackageState {
  packageName: string;
  hash: string;
  tags: string[];
  expiresAt: number;
  downloads: Record<string, number>;
  totalDownloads: number;
  pullRequest?: PullRequestRef;
  ttlMillis?: number;
  prTags?: string[];
}

export interface InitOptions {
  ttlMillis?: number;
  pullRequest?: PullRequestRef;
}

const emptyState: PackageState = {
  packageName: "",
  hash: "",
  tags: [],
  expiresAt: 0,
  downloads: {},
  totalDownloads: 0,
};

const EXPIRATION_EVENT = "expire";
const RETRY_DELAY_MS = 60_000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default class PackageStore extends Cloudflare.DurableObject<PackageStore>()(
  "PackageStore",
  Effect.gen(function* () {
    const r2 = yield* Cloudflare.R2.ReadWriteBucket(yield* Bucket);
    const kv = yield* Cloudflare.KV.ReadWriteNamespace(yield* TagIndex);

    return Effect.gen(function* () {
      const doState = yield* Cloudflare.DurableObjectState;

      const getState = Effect.gen(function* () {
        const stored = yield* doState.storage.get<PackageState>("state");
        return stored ?? emptyState;
      });

      const setState = (s: PackageState) => doState.storage.put("state", s);
      const scheduleExpiration = (expiresAt: number) =>
        Cloudflare.Workers.scheduleEvent(
          EXPIRATION_EVENT,
          new Date(expiresAt),
          null,
        ).pipe(Effect.provideService(Cloudflare.DurableObjectState, doState));
      const cancelExpiration = Cloudflare.Workers.cancelEvent(
        EXPIRATION_EVENT,
      ).pipe(Effect.provideService(Cloudflare.DurableObjectState, doState));
      const processExpirations = Cloudflare.Workers.processScheduledEvents.pipe(
        Effect.provideService(Cloudflare.DurableObjectState, doState),
      );

      const expireTags = (
        current: PackageState,
        tagsToRemove: Iterable<string>,
      ) =>
        Effect.gen(function* () {
          if (!current.packageName || !current.hash) return;
          const ref = tarballRef(current.packageName, current.hash);
          const id = tarballId(ref);
          const removing = new Set(tagsToRemove);
          for (const tag of removing) {
            const key = `tag:${current.packageName}:${tag}`;
            if ((yield* kv.get(key)) === id) {
              yield* kv.delete(key);
            }
          }

          const remaining = current.tags.filter((tag) => !removing.has(tag));
          if (remaining.length === 0) {
            yield* r2.delete(tarballKey(ref)).pipe(Effect.orDie);
            yield* doState.storage.delete("state");
            return;
          }

          yield* setState({
            packageName: current.packageName,
            hash: current.hash,
            tags: remaining,
            expiresAt: 0,
            downloads: current.downloads,
            totalDownloads: current.totalDownloads,
          });
          yield* cancelExpiration;
        });

      const tagsForPullRequest = (current: PackageState, number: number) => {
        const tags = new Set<string>([`pr-${number}`]);
        if (current.pullRequest?.number === number) {
          for (const tag of current.prTags ?? []) tags.add(tag);
        }
        return tags;
      };

      return {
        init: (
          packageName: string,
          hash: string,
          tags: string[],
          expiresAt: number,
          options?: InitOptions,
        ) =>
          Effect.gen(function* () {
            const current = yield* getState;
            const merged = new Set([...current.tags, ...tags]);
            const pullRequest = options?.pullRequest ?? current.pullRequest;
            const prTags = options?.pullRequest
              ? [...new Set([...(current.prTags ?? []), ...tags])]
              : current.prTags;
            const newState: PackageState = {
              packageName,
              hash,
              tags: [...merged],
              expiresAt,
              downloads: current.downloads,
              totalDownloads: current.totalDownloads,
            };
            if (pullRequest) newState.pullRequest = pullRequest;
            const ttlMillis = options?.ttlMillis ?? current.ttlMillis;
            if (ttlMillis) newState.ttlMillis = ttlMillis;
            if (prTags && prTags.length > 0) newState.prTags = prTags;
            yield* setState(newState);
            yield* scheduleExpiration(expiresAt);
          }),

        removeTag: (tag: string) =>
          Effect.gen(function* () {
            const current = yield* getState;
            const tags = current.tags.filter((t) => t !== tag);
            yield* setState({ ...current, tags });
            return { orphaned: tags.length === 0 };
          }),

        expirePullRequest: (number: number) =>
          Effect.gen(function* () {
            const current = yield* getState;
            yield* expireTags(current, tagsForPullRequest(current, number));
          }),

        recordDownload: (tag: string) =>
          Effect.gen(function* () {
            const current = yield* getState;
            const downloads = { ...current.downloads };
            downloads[tag] = (downloads[tag] ?? 0) + 1;
            yield* setState({
              ...current,
              downloads,
              totalDownloads: current.totalDownloads + 1,
            });
          }),

        getStats: () =>
          Effect.gen(function* () {
            const current = yield* getState;
            return {
              downloads: current.downloads,
              totalDownloads: current.totalDownloads,
            };
          }),

        getState: () => getState,

        alarm: () =>
          Effect.gen(function* () {
            const events = yield* processExpirations;
            if (!events.some((event) => event.id === EXPIRATION_EVENT)) return;

            yield* Effect.gen(function* () {
              const current = yield* getState;
              if (!current.packageName || !current.hash) return;

              if (current.pullRequest) {
                const state = yield* pullRequestState(current.pullRequest);
                if (shouldRenewOnTtl(true, state)) {
                  const ttl =
                    current.ttlMillis && current.ttlMillis > 0
                      ? current.ttlMillis
                      : WEEK_MS;
                  const expiresAt = Date.now() + ttl;
                  yield* setState({ ...current, expiresAt });
                  yield* scheduleExpiration(expiresAt);
                  return;
                }
                yield* expireTags(
                  current,
                  tagsForPullRequest(current, current.pullRequest.number),
                );
                return;
              }

              yield* expireTags(current, current.tags);
            }).pipe(
              Effect.catchCause((cause) =>
                scheduleExpiration(Date.now() + RETRY_DELAY_MS).pipe(
                  Effect.andThen(Effect.failCause(cause)),
                ),
              ),
            );
          }),
      };
    });
  }).pipe(
    Effect.provide(
      Layer.mergeAll(
        Cloudflare.R2.ReadWriteBucketBinding,
        Cloudflare.KV.ReadWriteNamespaceBinding,
      ),
    ),
  ),
) {}
