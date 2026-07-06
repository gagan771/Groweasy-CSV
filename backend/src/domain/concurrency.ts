/**
 * Runs an array of async tasks with a maximum concurrency limit.
 * Returns a settled-results array (same order as tasks).
 */
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<Array<PromiseSettledResult<T>>> {
  const results: Array<PromiseSettledResult<T>> = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      try {
        results[index] = { status: "fulfilled", value: await tasks[index]() };
      } catch (error) {
        results[index] = {
          status: "rejected",
          reason: error instanceof Error ? error : new Error(String(error)),
        };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}
