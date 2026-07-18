import { Registry } from 'prom-client';
import { randomUUID } from 'node:crypto';

let registry: Registry | undefined;

/**
 * Returns a process-wide singleton prom-client Registry.
 *
 * Each service should own exactly one Registry so metrics are not duplicated
 * across module re-imports (especially under HMR / request scoping).
 */
export function getRegistry(): Registry {
  if (!registry) {
    registry = new Registry();
    registry.setDefaultLabels({ instance: randomUUID().slice(0, 8) });
  }
  return registry;
}

/** Test/reset helper: drops the cached singleton. */
export function resetRegistry(): void {
  registry = undefined;
}
