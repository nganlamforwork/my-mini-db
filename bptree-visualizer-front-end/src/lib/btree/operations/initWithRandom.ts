// Initialize tree with random key-value pairs (resets existing data)
import type { CompositeKey, DBRecord, OperationResponse } from '../types';
import { clearTree, initTree } from '../storage';
import { insert } from './insert';

const DEFAULT_COUNT = 15;
const MIN_COUNT = 5;
const MAX_COUNT = 100;

/** Fisher–Yates shuffle to randomize array order */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Generate unique random integers in a range */
function generateRandomUniqueKeys(count: number): number[] {
  // Use a wider range (count * 10) to create gaps between keys
  // This allows users to insert their own keys between existing ones
  const maxValue = Math.max(count * 10, 100);
  const minValue = 1;
  const range = maxValue - minValue + 1;
  
  // If count is close to or larger than range, use sequential numbers
  if (count >= range * 0.9) {
    return shuffle(Array.from({ length: range }, (_, i) => minValue + i));
  }
  
  // Generate unique random keys
  const keySet = new Set<number>();
  let attempts = 0;
  const maxAttempts = count * 100; // Prevent infinite loops
  
  while (keySet.size < count && attempts < maxAttempts) {
    const randomKey = Math.floor(Math.random() * range) + minValue;
    keySet.add(randomKey);
    attempts++;
  }
  
  // If we couldn't generate enough unique keys, fill with sequential
  if (keySet.size < count) {
    let nextKey = minValue;
    while (keySet.size < count) {
      if (!keySet.has(nextKey)) {
        keySet.add(nextKey);
      }
      nextKey++;
    }
  }
  
  return shuffle(Array.from(keySet));
}

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function randomChar(): string {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

/** Random string of length 1–4 from A–Z and a–z */
function randomValueString(): string {
  const len = 1 + Math.floor(Math.random() * 4);
  return Array.from({ length: len }, () => randomChar()).join('');
}

function makeKey(n: number): CompositeKey {
  return { values: [{ type: 'int', value: n }] };
}

function makeValue(s: string): DBRecord {
  return { columns: [{ type: 'string', value: s }] };
}

/**
 * Reset the tree and insert `count` random int keys with random A–Z / a–z string values.
 * Keys are truly random (not sequential) to create gaps where users can insert their own keys.
 */
export function initWithRandomData(
  treeName: string,
  count: number = DEFAULT_COUNT
): OperationResponse {
  const n = Math.max(MIN_COUNT, Math.min(MAX_COUNT, Math.floor(count)));
  const keys = generateRandomUniqueKeys(n);

  clearTree(treeName);
  initTree(treeName);

  const insertedKeys: CompositeKey[] = [];
  const insertedValues: DBRecord[] = [];

  for (const k of keys) {
    const key = makeKey(k);
    const value = makeValue(randomValueString());
    const res = insert(treeName, key, value);
    if (!res.success) {
      return { success: false, operation: 'INSERT', error: res.error ?? 'Insert failed during init' };
    }
    insertedKeys.push(key);
    insertedValues.push(value);
  }

  return {
    success: true,
    operation: 'INSERT',
    keys: insertedKeys,
    values: insertedValues,
  };
}

export { DEFAULT_COUNT, MIN_COUNT, MAX_COUNT };
