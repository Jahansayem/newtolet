// Labelled API keys: `label:key,label:key` lists, compared in constant time.
// Same rules as the agent-listings keys. No Deno imports, so tests can load it in Node.

export type ApiKey = { label: string; key: string };

export const MIN_KEY_LENGTH = 32;
const KEY_LABEL_REGEX = /^[a-z0-9][a-z0-9_-]{0,31}$/i;

export class ApiKeyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiKeyConfigError";
  }
}

/**
 * Parses one env value. Error messages name the label only; a key must never
 * reach the logs.
 */
export const parseKeyList = (raw: string | undefined | null, envName: string): ApiKey[] => {
  const keys: ApiKey[] = [];
  const entries = (raw || "").split(",").map((entry) => entry.trim()).filter(Boolean);
  for (const entry of entries) {
    const separator = entry.indexOf(":");
    const label = separator > 0 ? entry.slice(0, separator).trim().toLowerCase() : "";
    const key = separator > 0 ? entry.slice(separator + 1).trim() : "";
    if (!KEY_LABEL_REGEX.test(label)) {
      throw new ApiKeyConfigError(`${envName} has an entry that is not label:key`);
    }
    if (key.length < MIN_KEY_LENGTH) {
      throw new ApiKeyConfigError(`${envName}: key "${label}" is shorter than ${MIN_KEY_LENGTH} characters`);
    }
    if (keys.some((existing) => existing.label === label)) {
      throw new ApiKeyConfigError(`${envName}: label "${label}" is used twice`);
    }
    keys.push({ label, key });
  }
  return keys;
};

const digest = async (value: string) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));

// Compare hashes so the comparison time does not depend on where the keys differ.
const secretsMatch = async (candidate: string, expected: string) => {
  const [a, b] = await Promise.all([digest(candidate), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
};

export const bearerToken = (authorization: string | null | undefined) => {
  const value = authorization || "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
};

/**
 * Returns the matching key entry or null. Every configured key is checked
 * without stopping at the first match, so timing does not show which matched.
 */
export const matchKey = async <T extends ApiKey>(candidate: string, keys: T[]): Promise<T | null> => {
  let matched: T | null = null;
  if (!candidate) return null;
  for (const entry of keys) {
    if ((await secretsMatch(candidate, entry.key)) && matched === null) matched = entry;
  }
  return matched;
};
