// Constantes pour les unités de quantité
export const QUANTITY_UNITS = [
  { value: 'kg', label: 'kg' },
  { value: 'gr.', label: 'gr.' },
  { value: 'l.', label: 'l.' },
  { value: 'ml', label: 'ml' },
  { value: 'unité', label: 'unité·s' },
  { value: 'bottes', label: 'botte·s' },
] as const;

export type QuantityUnit = typeof QUANTITY_UNITS[number]['value'];
