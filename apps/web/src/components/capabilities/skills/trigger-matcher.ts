/**
 * Token-set trigger matching — the single client-side mirror of the backend
 * matcher (`apps/api/src/api/services/skill_injection.py` — `_trigger_hits`).
 *
 * A declared trigger matches when **every token of the trigger phrase appears
 * somewhere in the message**. Order and adjacency do not matter; token
 * equality does (`parse` does not match `parser`). A skill declaring no
 * triggers is "ambient" — always eligible — which is the caller's concern,
 * not the matcher's: this module returns hits only.
 *
 * Both the Trigger Simulator and the Playground drawer must route through this
 * module so a client-side preview can never disagree with the server. The
 * shared case matrix lives in
 * `apps/api/tests/fixtures/skills-trigger-matrix.json` and is asserted from
 * both stacks.
 *
 * Tokenization mirrors Python's `re.split(r"[^\w]+", text.lower())`: `\w` is
 * Unicode letters, digits, and underscore, so `[^\p{L}\p{N}_]` with the `u`
 * flag is the closest JavaScript equivalent.
 */

const TOKEN_SPLIT = /[^\p{L}\p{N}_]+/u;

export function tokenizeText(text: string): string[] {
  return (text || '').toLowerCase().split(TOKEN_SPLIT).filter(Boolean);
}

export function matchTriggerHits(
  triggers: readonly string[] | null | undefined,
  message: string,
): string[] {
  const declared = (triggers ?? []).filter((trigger) => trigger.trim());
  if (declared.length === 0) return [];

  const hayTokens = new Set(tokenizeText(message));
  if (hayTokens.size === 0) return [];

  return declared.filter((trigger) => {
    const neededTokens = new Set(tokenizeText(trigger));
    if (neededTokens.size === 0) return false;
    return Array.from(neededTokens).every((token) => hayTokens.has(token));
  });
}
