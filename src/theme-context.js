import { createContext, useContext, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { buildTheme, DEFAULT_PALETTE } from './theme';
import { useAuth } from './auth-context';

const ThemeContext = createContext(buildTheme(DEFAULT_PALETTE));

/**
 * The owner's chosen colours live on their business document, so the theme
 * follows the account rather than the device — sign in on a new phone and the
 * shop looks like itself straight away.
 */
export function ThemeProvider({ children }) {
  const { business } = useAuth();

  const theme = useMemo(
    () => buildTheme(business?.theme || DEFAULT_PALETTE),
    [business?.theme?.accent, business?.theme?.paper, business?.theme?.ink]
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
export const useColors = () => useContext(ThemeContext).colors;

/**
 * Styles have to be built per theme rather than once at module load, or the
 * colours freeze at whatever they were when the file was first imported.
 * Pass a module-level `makeStyles(theme)` so the memo key stays stable.
 */
export function useThemedStyles(makeStyles) {
  const theme = useTheme();
  return useMemo(() => StyleSheet.create(makeStyles(theme)), [theme, makeStyles]);
}
