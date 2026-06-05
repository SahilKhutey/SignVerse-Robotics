import { describe, it, expect } from 'vitest';
import { getStableColor } from '../../lib/colorByHash';

describe('lib/colorByHash.test.ts', () => {
  it('same_label_always_same_color', () => {
    const color = getStableColor('reach_left');
    for (let i = 0; i < 100; i++) {
      expect(getStableColor('reach_left')).toBe(color);
    }
  });

  it('different_labels_different_colors_usually', () => {
    const labels = [
      'label_1', 'label_2', 'label_3', 'label_4', 'label_5',
      'label_6', 'label_7', 'label_8', 'label_9', 'label_10'
    ];
    const colors = labels.map(getStableColor);
    const uniqueColors = new Set(colors);
    // At least 8 distinct colors
    expect(uniqueColors.size).toBeGreaterThanOrEqual(8);
  });

  it('color_stable_when_new_label_inserted', () => {
    const colorA = getStableColor('A');
    const colorB = getStableColor('B');
    const colorC = getStableColor('C');

    // [A, B, C] yields [colorA, colorB, colorC]
    // Insert D at front: [D, A, B, C]
    const colorD = getStableColor('D');
    
    // A's color should still be identical to colorA
    expect(getStableColor('A')).toBe(colorA);
    expect(getStableColor('B')).toBe(colorB);
    expect(getStableColor('C')).toBe(colorC);
  });
});
