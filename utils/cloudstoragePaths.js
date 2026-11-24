const fs = require("fs");
const path = require("path");

const BUNDLED_SYSTEM_DIR = path.join(__dirname, "..", "cloudstorage", "system");
const BUNDLED_USER_DIR = path.join(__dirname, "..", "cloudstorage", "user");

function getSystemDir() {
  const target = process.env.VELOCITY_CLOUDSTORAGE_SYSTEM_DIR || BUNDLED_SYSTEM_DIR;
  fs.mkdirSync(target, { recursive: true });
  if (path.resolve(target) !== path.resolve(BUNDLED_SYSTEM_DIR) && fs.existsSync(BUNDLED_SYSTEM_DIR)) {
    for (const file of fs.readdirSync(BUNDLED_SYSTEM_DIR)) {
      if (!file.toLowerCase().endsWith(".ini")) continue;
      const source = path.join(BUNDLED_SYSTEM_DIR, file);
      const destination = path.join(target, file);
      if (!fs.existsSync(destination) && fs.statSync(source).isFile()) {
        fs.copyFileSync(source, destination);
      }
    }
  }
  return target;
}

function getUserDir() {
  const target = process.env.VELOCITY_CLOUDSTORAGE_USER_DIR || BUNDLED_USER_DIR;
  fs.mkdirSync(target, { recursive: true });
  return target;
}

module.exports = { getSystemDir, getUserDir };
