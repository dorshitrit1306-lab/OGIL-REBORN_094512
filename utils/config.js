const fs = require("fs");
const path = require("path");

const configDir = path.join(__dirname, "..", "config");
const bundledConfigPath = path.join(configDir, "config.json");
const examplePath = path.join(configDir, "config.example.json");
const configPath = process.env.VELOCITY_CONFIG_FILE || bundledConfigPath;

let cachedConfig = null;

function ensureConfigFile() {
  if (fs.existsSync(configPath)) return configPath;
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const source = fs.existsSync(bundledConfigPath) ? bundledConfigPath : examplePath;
  if (!fs.existsSync(source)) {
    throw new Error("Missing bundled and example backend configuration files.");
  }
  fs.copyFileSync(source, configPath);
  return configPath;
}

/** Return one shared mutable config object so every backend module sees panel updates. */
function loadConfig() {
  if (cachedConfig) return cachedConfig;
  ensureConfigFile();
  cachedConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return cachedConfig;
}

module.exports = { configPath, ensureConfigFile, loadConfig };
