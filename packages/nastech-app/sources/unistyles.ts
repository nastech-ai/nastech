import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';
import { darkTheme, lightTheme, amoledTheme } from './theme';
import { loadThemePreference } from './sync/persistence';
import { Appearance, Platform } from 'react-native';
import * as SystemUI from 'expo-system-ui';

const appThemes = {
    light: lightTheme,
    dark: darkTheme,
    amoled: amoledTheme,
};

const breakpoints = {
    xs: 0,
    sm: 300,
    md: 500,
    lg: 800,
    xl: 1200,
};

const themePreference = loadThemePreference();

const getInitialTheme = (): 'light' | 'dark' | 'amoled' => {
    if (themePreference === 'adaptive') {
        const systemTheme = Appearance.getColorScheme();
        return systemTheme === 'dark' ? 'dark' : 'light';
    }
    return themePreference;
};

const settings = themePreference === 'adaptive'
    ? { adaptiveThemes: true, CSSVars: true }
    : { initialTheme: getInitialTheme(), CSSVars: true };

type AppThemes = typeof appThemes;
type AppBreakpoints = typeof breakpoints;

declare module 'react-native-unistyles' {
    export interface UnistylesThemes extends AppThemes { }
    export interface UnistylesBreakpoints extends AppBreakpoints { }
}

StyleSheet.configure({
    settings,
    breakpoints,
    themes: appThemes,
});

const setRootBackgroundColor = () => {
    if (themePreference === 'adaptive') {
        const systemTheme = Appearance.getColorScheme();
        const color = systemTheme === 'dark'
            ? appThemes.dark.colors.groupped.background
            : appThemes.light.colors.groupped.background;
        UnistylesRuntime.setRootViewBackgroundColor(color);
        SystemUI.setBackgroundColorAsync(color);
    } else {
        const color = appThemes[themePreference]?.colors?.groupped?.background
            ?? appThemes.dark.colors.groupped.background;
        UnistylesRuntime.setRootViewBackgroundColor(color);
        SystemUI.setBackgroundColorAsync(color);
    }
};

setRootBackgroundColor();

if (Platform.OS === 'web' && themePreference === 'adaptive') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            const themeName = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
            UnistylesRuntime.setAdaptiveThemes(false);
            UnistylesRuntime.setTheme(themeName);
            UnistylesRuntime.setAdaptiveThemes(true);
            const color = appThemes[themeName].colors.groupped.background;
            UnistylesRuntime.setRootViewBackgroundColor(color);
        }
    });
}
