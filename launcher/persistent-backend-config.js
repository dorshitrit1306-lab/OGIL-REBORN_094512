const fs = require("fs");
const path = require("path");

/**
 * Keep editable backend configuration in the user's data directory.
 * The packaged backend still reads its normal config/config.json path, so
 * the persistent copy is synchronized before the backend process starts.
 */
function syncPersistentBackendConfig(bundledConfigPath, persistentConfigPath) {
  if (!bundledConfigPath || !persistentConfigPath) {
    throw new Error("Both backend and persistent config paths are required.");
  }
  if (!fs.existsSync(bundledConfigPath)) {
    throw new Error(`Bundled backend config not found: ${bundledConfigPath}`);
  }
  fs.mkdirSync(path.dirname(persistentConfigPath), { recursive: true });
  if (fs.existsSync(persistentConfigPath)) {
    fs.copyFileSync(persistentConfigPath, bundledConfigPath);
  } else {
    fs.copyFileSync(bundledConfigPath, persistentConfigPath);
  }
  return persistentConfigPath;
}

module.exports = { syncPersistentBackendConfig };
