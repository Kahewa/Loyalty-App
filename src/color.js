/**
 * Small colour helpers, so a business can pick its own brand colour without
 * being able to make its own app unreadable.
 *
 * The rule this file exists to enforce: the owner chooses hues, the app chooses
 * the text that sits on them. Letting someone pick white-on-cream by hand is a
 * support ticket waiting to happen.
 */

export function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export const rgbToHex = (r, g, b) =>
  '#' +
  [r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('');

/** WCAG relative luminance. */
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const chan = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Whichever of the candidates reads best on `bg`. */
export function readableOn(bg, candidates = ['#FFFFFF', '#22251F']) {
  return candidates.reduce((best, c) =>
    contrastRatio(bg, c) > contrastRatio(bg, best) ? c : best
  );
}

export function mix(a, b, amount) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(
    ca.r + (cb.r - ca.r) * amount,
    ca.g + (cb.g - ca.g) * amount,
    ca.b + (cb.b - ca.b) * amount
  );
}

export const lighten = (hex, amount) => mix(hex, '#FFFFFF', amount);
export const darken = (hex, amount) => mix(hex, '#000000', amount);

/** Translucent overlay without alpha compositing surprises on Android. */
export const tint = (hex, onto, amount) => mix(onto, hex, amount);

export function hslToHex(h, s, l) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return (l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))) * 255;
  };
  return rgbToHex(f(0), f(8), f(4));
}

export function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const l = (max + min) / 2;

  if (d === 0) return { h: 0, s: 0, l: Math.round(l * 100) };

  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;

  return {
    h: Math.round(((h * 60) + 360) % 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export const isHex = (v) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v || ''));
