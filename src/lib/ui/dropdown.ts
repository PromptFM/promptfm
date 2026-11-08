// src/lib/ui/dropdown.ts
// Dismiss decisions for disclosure-style dropdowns (outside pointer, focus leaving, Escape).

interface Container {
  contains(other: unknown): boolean;
}

export function isOutside(container: Container | null, node: unknown): boolean {
  if (!container || !node) return false;
  return !container.contains(node);
}

export function isDismissKey(key: string): boolean {
  return key === 'Escape';
}
