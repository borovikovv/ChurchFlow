export interface LatestRequest {
  /** Starts a request and returns its id. */
  begin: () => number;
  /** Whether no request has started since the one with this id. */
  isLatest: (id: number) => boolean;
}

/**
 * Tracks overlapping requests for the same data so only the answer to the most recent one is
 * applied; an older answer that arrives late would otherwise overwrite newer state.
 */
export function createLatestRequest(): LatestRequest {
  let latest = 0;

  return {
    begin: () => {
      latest += 1;
      return latest;
    },
    isLatest: (id) => id === latest,
  };
}
