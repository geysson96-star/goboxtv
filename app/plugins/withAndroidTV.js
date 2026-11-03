// Faz o APK aparecer na tela inicial de Android TV / TV Box (Leanback) e libera
// links http:// (muitas listas IPTV não usam https).
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAndroidTV(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    manifest['uses-feature'] = manifest['uses-feature'] || [];
    const addFeature = (name) => {
      if (!manifest['uses-feature'].some((f) => f.$['android:name'] === name)) {
        manifest['uses-feature'].push({ $: { 'android:name': name, 'android:required': 'false' } });
      }
    };
    addFeature('android.hardware.touchscreen');
    addFeature('android.software.leanback');

    const app = manifest.application[0];
    app.$['android:usesCleartextTraffic'] = 'true';
    app.$['android:banner'] = app.$['android:banner'] || '@mipmap/ic_launcher';

    const activity = (app.activity || []).find((a) => a.$['android:name'] === '.MainActivity');
    if (activity) {
      activity['intent-filter'] = activity['intent-filter'] || [];
      const launcher = activity['intent-filter'].find((f) => (f.action || []).some((x) => x.$['android:name'] === 'android.intent.action.MAIN'));
      if (launcher) {
        launcher.category = launcher.category || [];
        if (!launcher.category.some((c) => c.$['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER')) {
          launcher.category.push({ $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' } });
        }
      }
    }
    return cfg;
  });
};
