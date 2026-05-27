const { execSync } = require('child_process');

function tryPatch(name) {
  try {
    require(name);
  } catch (e) {
    console.warn(`[postinstall] patch ${name} skipped: ${e.message}`);
  }
}

tryPatch('../patches/fix-pglite-prisma-bytes.cjs');
tryPatch('../patches/fix-livekit-room-reuse.cjs');
tryPatch('../patches/expose-pierre-diffs-style.cjs');
tryPatch('../patches/force-preact-cjs.cjs');
tryPatch('../patches/fix-pierre-trees-preact-hooks.cjs');

if (process.env.SKIP_NASTECH_WIRE_BUILD === '1') {
  console.log('[postinstall] SKIP_NASTECH_WIRE_BUILD=1, skipping @nastech-ai/nastech-wire build');
  process.exit(0);
}

try {
  execSync('pnpm --filter @nastech-ai/nastech-wire build', {
    stdio: 'inherit',
  });
} catch (e) {
  console.warn('[postinstall] nastech-wire build failed (non-fatal in CI):', e.message);
}
