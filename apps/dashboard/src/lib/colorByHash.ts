/**
 * Generates a stable HSL color based on the hash of a string label.
 * Ensures the same task label always gets the same color.
 */
export function getStableColor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 80%, 55%)`;
}
