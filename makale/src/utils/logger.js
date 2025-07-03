const fs = require("fs");
const path = require("path");

function logEvent(message) {
    const logDir = path.join(__dirname, "..", "logs");
    const logPath = path.join(logDir, "editor_log.txt");
    const timestamp = new Date().toISOString();

    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`, "utf8");
}

module.exports = { logEvent };
