/** How long to wait before reconnecting, doubling to half a minute. */
export function retryDelay(attempt: number) {
  return Math.min(30_000, 1_000 * 2 ** attempt);
}
