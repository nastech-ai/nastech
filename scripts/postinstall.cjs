const { execSync } = require('child_process');

// Apply patches to node_modules
require('../patches/fix-pglite-prisma-bytes.cjs');
require('../patches/fix-livekit-room-reuse.cjs');
require('../patches/expose-pierre-diffs-style.cjs');
require('../patches/force-preact-cjs.cjs');
require('../patches/fix-pierre-trees-preact-hooks.cjs');

if (process.env.SKIP_NASTECH_WIRE_BUILD === '1') {
  console.log('[postinstall] SKIP_NASTECH_WIRE_BUILD=1, skipping @nastech-ai/nastech-wire build');
  process.exit(0);
}

execSync('pnpm --filter @nastech-ai/nastech-wire build', {
  stdio: 'inherit',
});
