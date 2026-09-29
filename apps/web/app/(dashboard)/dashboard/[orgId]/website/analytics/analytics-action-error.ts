/** A failed analytics request, keeping the API error code the panel branches on. */
export class AnalyticsActionError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'AnalyticsActionError';
  }
}
