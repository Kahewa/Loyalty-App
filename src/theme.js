import { darken, lighten, mix, readableOn, isHex, contrastRatio } from './color';

/**
 * A whole theme is derived from three choices: an accent (the brand colour), a
 * paper colour (the background) and an ink (the text). Everything else is worked
 * out from those — and clamped — so no combination the owner can pick ends up
 * unreadable.
 *
 * Defaults come from the Loyalty Link logo: sage green, blush pink, navy ink on
 * cream.
 */

export const BRAND = {
  sage: '#8CAA80',
  blush: '#E9C0D8',
  navy: '#2C3A52',
  cream: '#F7F3EA',
};

export const DEFAULT_PALETTE = {
  accent: BRAND.sage,
  paper: BRAND.cream,
  ink: BRAND.navy,
};

export const PRESETS = [
  { id: 'brand', name: 'Loyalty Link', accent: BRAND.sage, paper: BRAND.cream, ink: BRAND.navy },
  { id: 'blush', name: 'Blush', accent: '#C77FA6', paper: '#FBF2F7', ink: BRAND.navy },
  { id: 'clay', name: 'Clay', accent: '#B26744', paper: '#F9F1E9', ink: '#43382F' },
  { id: 'sea', name: 'Sea Glass', accent: '#3F8481', paper: '#EFF4F2', ink: '#26373A' },
  { id: 'plum', name: 'Plum', accent: '#7A5686', paper: '#F6F1F6', ink: '#3B3340' },
  { id: 'slate', name: 'Slate', accent: '#556781', paper: '#F1F3F6', ink: '#2C3A52' },
];

const fallback = (value, dflt) => (isHex(value) ? value : dflt);

/** Darken until this reads properly against `against`. */
function ensureText(color, against, min) {
  let c = color;
  for (let i = 0; i < 26 && contrastRatio(c, against) < min; i++) c = darken(c, 0.07);
  return c;
}

/**
 * A solid fill has to be able to carry a label. Some mid-tones — bright
 * yellow-greens especially — are too dark for black text and too light for
 * white, so nudge them until one side wins. The picker previews the clamped
 * result, so what you choose is what you see.
 */
function ensureFill(color, min) {
  let c = color;
  for (let i = 0; i < 26; i++) {
    const best = Math.max(contrastRatio(c, '#FFFFFF'), contrastRatio(c, '#1A1D22'));
    if (best >= min) return c;
    c = darken(c, 0.06);
  }
  return c;
}

export function buildTheme(palette) {
  const picked = fallback(palette?.accent, DEFAULT_PALETTE.accent);
  const paper = fallback(palette?.paper, DEFAULT_PALETTE.paper);
  const ink = fallback(palette?.ink, DEFAULT_PALETTE.ink);

  const accent = ensureFill(picked, 4.5);

  // Cards sit slightly above the paper rather than pure white, which keeps the
  // warmth of a cream background instead of punching holes in it.
  const surface = lighten(paper, 0.55);
  const accentSoft = mix(paper, accent, 0.15);

  // Status colours borrow a little of the accent so the palette reads as one
  // family, then get clamped against the surface they actually sit on.
  const successSoft = mix(paper, mix('#3F7A4C', accent, 0.2), 0.15);
  const dangerSoft = mix(paper, '#A8453C', 0.12);
  const warningSoft = mix(paper, '#B57D26', 0.15);

  return {
    colors: {
      bg: paper,
      surface,
      surfaceAlt: mix(paper, ink, 0.06),
      border: mix(paper, ink, 0.13),
      borderStrong: mix(paper, ink, 0.24),

      text: ink,
      textDim: ensureText(mix(ink, paper, 0.4), surface, 4.5),
      textFaint: ensureText(mix(ink, paper, 0.55), surface, 3.0),

      accent,
      accentText: readableOn(accent, ['#FFFFFF', '#1A1D22']),
      // For accent-coloured *text*, which the raw accent is often too pale for.
      accentInk: ensureText(accent, accentSoft, 4.5),
      accentSoft,
      accentEdge: mix(paper, accent, 0.4),

      // The logo's second colour, kept as a fixed brand note for celebratory
      // moments rather than something the palette derives.
      blush: BRAND.blush,
      blushSoft: mix(paper, BRAND.blush, 0.4),
      blushInk: ensureText(BRAND.blush, mix(paper, BRAND.blush, 0.4), 4.5),

      success: ensureText(mix('#3F7A4C', accent, 0.2), successSoft, 4.5),
      successSoft,
      danger: ensureText('#A8453C', dangerSoft, 4.5),
      dangerSoft,
      warning: ensureText('#B57D26', warningSoft, 4.5),
      warningSoft,

      shadow: darken(paper, 0.6),
      stampEmpty: mix(paper, ink, 0.13),
    },
    palette: { accent: picked, paper, ink },
  };
}

export const spacing = (n) => n * 8;

export const radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 };

export const shadow = (color, level = 1) => ({
  shadowColor: color,
  shadowOpacity: 0.08 + level * 0.03,
  shadowRadius: 6 + level * 6,
  shadowOffset: { width: 0, height: 2 + level * 2 },
  elevation: level * 2,
});

export const font = {
  display: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  title: { fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '500' },
  small: { fontSize: 13, fontWeight: '500' },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
};
