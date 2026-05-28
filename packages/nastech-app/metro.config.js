const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const monorepoRoot = path.resolve(__dirname, "../..");
const nastechWireSrc = path.resolve(monorepoRoot, "packages/nastech-wire/src/index.ts");

const config = getDefaultConfig(__dirname, {
  // Enable CSS support for web
  isCSSEnabled: true,
});

// Watch the whole monorepo so Metro picks up workspace package changes
// Merge with Expo's defaults instead of replacing them
config.watchFolders = [...(config.watchFolders || []), monorepoRoot];

// Add support for .wasm files (required by Skia for all platforms)
// Source: https://shopify.github.io/react-native-skia/docs/getting-started/installation/
config.resolver.assetExts.push('wasm');

// Exclude Tauri Rust build artifacts from Metro's file watcher.
// Cargo writes/deletes transient files in src-tauri/target/debug/deps during
// `tauri dev`, which crashes Metro's fallback watcher on Windows with ENOENT.
config.resolver.blockList = [
  /[/\\]src-tauri[/\\]target[/\\].*/,
];

// Force every preact / preact/hooks import (ESM or CJS, from any package) to
// resolve to a SINGLE file. preact's package.json exports field maps "import"
// to preact.mjs and "require" to preact.js, which makes Metro register two
// separate module instances depending on the importer's module type. Two
// instances mean two `options` objects — preact/hooks patches one,
// @pierre/trees renders against the other, currentComponent stays undefined,
// `r.__H` crashes. Pin to the CJS bundles so everyone shares state.
const preactCjsPath = require.resolve('preact');
const preactHooksCjsPath = require.resolve('preact/hooks');
const baseResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'preact') {
    return { filePath: preactCjsPath, type: 'sourceFile' };
  }
  if (moduleName === 'preact/hooks') {
    return { filePath: preactHooksCjsPath, type: 'sourceFile' };
  }
  // Resolve @nastech-ai/nastech-wire from TypeScript source directly.
  // The dist/ folder is not built during EAS builds (SKIP_NASTECH_WIRE_BUILD=1),
  // so pointing Metro at the source avoids a missing-file crash at bundle time.
  if (moduleName === '@nastech-ai/nastech-wire') {
    return { filePath: nastechWireSrc, type: 'sourceFile' };
  }
  if (baseResolveRequest) {
    return baseResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Enable inlineRequires for proper Skia and Reanimated loading
// Source: https://shopify.github.io/react-native-skia/docs/getting-started/web/
// Without this, Skia throws "react-native-reanimated is not installed" error
// This is cross-platform compatible (iOS, Android, web)
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true, // Critical for @shopify/react-native-skia
  },
});

module.exports = config;