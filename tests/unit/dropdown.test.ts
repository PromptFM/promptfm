// tests/unit/dropdown.test.ts
import { describe, it, expect } from 'vitest';
import { isOutside, isDismissKey } from '@/lib/ui/dropdown';

const container = (inside: unknown[]) => ({ contains: (n: unknown) => inside.includes(n) });

describe('isOutside', () => {
  const inner = { id: 'inner' };
  const other = { id: 'other' };

  it('is false for a node inside the container', () => {
    expect(isOutside(container([inner]), inner)).toBe(false);
  });

  it('is true for a node outside the container', () => {
    expect(isOutside(container([inner]), other)).toBe(true);
  });

  it('is false when there is no container to compare against', () => {
    expect(isOutside(null, other)).toBe(false);
  });

  it('is false when focus or the pointer has no target node', () => {
    expect(isOutside(container([inner]), null)).toBe(false);
  });
});

describe('isDismissKey', () => {
  it('dismisses on Escape', () => {
    expect(isDismissKey('Escape')).toBe(true);
  });

  it.each(['Enter', ' ', 'Tab', 'ArrowDown', 'escape', ''])('ignores %j', (key) => {
    expect(isDismissKey(key)).toBe(false);
  });
});
