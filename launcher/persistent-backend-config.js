const fs = require("fs");
const path = require("path");

/**
 * Seed the user-owned config file once. Never write into the install/resources
 * directory: installed apps may live under Program Files and be read-only.
 */
function syncPersistentBackendConfig(bundledConfigPath, persistentConfigPath) {
  if (!bundledConfigPath || !persistentConfigPath) {
    throw new Error("Both backend and persistent config paths are required.");
  }
  if (!fs.existsSync(bundledConfigPath)) {
    throw new Error(`Bundled backend config not found: ${bundledConfigPath}`);
  }
  fs.mkdirSync(path.dirname(persistentConfigPath), { recursive: true });
  if (!fs.existsSync(persistentConfigPath)) {
    fs.copyFileSync(bundledConfigPath, persistentConfigPath);
  }
  return persistentConfigPath;
}

module.exports = { syncPersistentBackendConfig };
