/** Font family of text painted on the canvas: the platform UI font, with CJK fallbacks. */
export const CANVAS_FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'

/** Applies `alpha` to `#rgb` / `#rrggbb` colours; other colour syntaxes are returned unchanged. */
export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgba(') || color.startsWith('hsla(')) {
    return color
  }

  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
    const hex =
      color.length === 4
        ? color
            .slice(1)
            .split('')
            .map((value) => value + value)
            .join('')
        : color.slice(1)
    const red = Number.parseInt(hex.slice(0, 2), 16)
    const green = Number.parseInt(hex.slice(2, 4), 16)
    const blue = Number.parseInt(hex.slice(4, 6), 16)

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`
  }

  return color
}

/** Lightens (positive `amount`) or darkens a `#rrggbb` colour by `amount` per channel. */
export function adjustColor(hex: string, amount: number): string {
  const clamp = (val: number) => Math.min(255, Math.max(0, val))
  const num = parseInt(hex.slice(1), 16)
  const r = clamp((num >> 16) + amount)
  const g = clamp(((num >> 8) & 0x00ff) + amount)
  const b = clamp((num & 0x0000ff) + amount)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}
