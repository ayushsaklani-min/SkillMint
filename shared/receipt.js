/**
 * Deterministic JSON serializer for SkillMint receipts.
 *
 * Guarantees: same input object → byte-identical output string, regardless of
 * insertion order or runtime JS engine behavior. Keys sorted recursively
 * (alphabetical, ascending). Arrays preserved in order. Undefined values
 * dropped per JSON.stringify semantics.
 *
 * This is the single source of truth for "this receipt = these bytes = this hash."
 * Oracle must serialize with this before uploading to 0G Storage.
 */

function sortedReplacer(_key, value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const sorted = {};
    for (const k of Object.keys(value).sort()) {
      sorted[k] = value[k];
    }
    return sorted;
  }
  return value;
}

export function serializeReceipt(receipt) {
  if (receipt == null || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new TypeError('serializeReceipt: receipt must be an object');
  }
  return JSON.stringify(receipt, sortedReplacer);
}
