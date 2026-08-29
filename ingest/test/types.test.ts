import { describe, expect, it } from 'vitest';
import { CATEGORY_TAXONOMY, getCategoryGroup, isKnownCategory, registerCategory } from '../src/types.js';

describe('CATEGORY_TAXONOMY', () => {
  it('gives every built-in category a valid needs/wants/savings group', () => {
    const validGroups = new Set(['needs', 'wants', 'savings']);
    for (const [category, group] of Object.entries(CATEGORY_TAXONOMY)) {
      expect(validGroups.has(group), `category "${category}" has invalid group "${group}"`).toBe(true);
    }
  });

  it('getCategoryGroup throws for an unregistered category', () => {
    expect(() => getCategoryGroup('definitely_not_a_real_category')).toThrow();
  });

  it('isKnownCategory reflects registration state', () => {
    expect(isKnownCategory('rent')).toBe(true);
    expect(isKnownCategory('not_a_category_xyz')).toBe(false);
  });

  it('registerCategory makes a new category usable via getCategoryGroup', () => {
    registerCategory('test_only_streaming', 'wants');
    expect(getCategoryGroup('test_only_streaming')).toBe('wants');
  });

  it('registerCategory is a harmless no-op when re-registering with the same group', () => {
    registerCategory('test_only_idempotent', 'needs');
    expect(() => registerCategory('test_only_idempotent', 'needs')).not.toThrow();
  });

  it('registerCategory refuses to silently redefine an existing category to a different group', () => {
    registerCategory('test_only_conflict', 'needs');
    expect(() => registerCategory('test_only_conflict', 'wants')).toThrow();
  });
});
