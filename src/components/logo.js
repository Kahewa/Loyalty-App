import Svg, { Path } from 'react-native-svg';
import { BRAND } from '../theme';

/**
 * The Loyalty Link mark: two nested "L" strokes, sage behind and blush in
 * front, sweeping into a shared baseline.
 *
 * Drawn rather than imported so it scales cleanly and picks up the theme.
 * Swap in assets/logo.png if you want the exact artwork.
 */
export function Logo({ size = 72, sage = BRAND.sage, blush = BRAND.blush }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Path
        d="M24 12 V62 C24 82 36 86 56 86 H92"
        stroke={sage}
        strokeWidth={11}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M40 12 V60 C40 78 50 82 68 82 H94"
        stroke={blush}
        strokeWidth={11}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
