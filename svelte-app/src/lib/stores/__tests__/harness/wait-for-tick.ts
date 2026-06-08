/**
 * Wait for microtasks and macrotasks to settle.
 *
 * `$effect`, Dexie `liveQuery`, and `bridgeToMap` all propagate changes
 * asynchronously. After triggering a Dexie write in a test, you must wait
 * several ticks before asserting on the SvelteMap / `$derived` outputs,
 * otherwise you'll observe stale state.
 *
 * Default 3 iterations handles most cases. Pass a higher `times` for chained
 * async operations (e.g. write → recalc → re-render).
 */
export async function waitForTick(times = 3): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  }
}
