// Android 11+ package visibility (Phase 28): lets the app check that
// Instagram and WhatsApp are installed before sharing a card straight to
// them; otherwise it falls back to the system share sheet.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withShareTargets(config, { packages = [] } = {}) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const queries = (manifest.queries = manifest.queries ?? [{}]);
    const entry = queries[0];
    entry.package = entry.package ?? [];
    for (const name of packages)
      if (!entry.package.some((p) => p.$['android:name'] === name))
        entry.package.push({ $: { 'android:name': name } });
    return cfg;
  });
};
