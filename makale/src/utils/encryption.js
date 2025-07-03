const crypto = require("crypto");
const base64 = require("base-64");

function pad(s) {
    const padLen = 16 - (Buffer.byteLength(s, "utf8") % 16);
    return s + String.fromCharCode(padLen).repeat(padLen);
}

function unpad(s) {
    return s.slice(0, -s.charCodeAt(s.length - 1));
}

function encrypt(text, key) {
    if (!text || typeof text !== "string") text = "UNKNOWN";
    key = key.padEnd(32).slice(0, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key), iv);
    let encrypted = cipher.update(pad(text), "utf8", "base64");
    encrypted += cipher.final("base64");
    return base64.encode(iv.toString("base64") + "::" + encrypted);
}

function decrypt(encoded, key) {
    key = key.padEnd(32).slice(0, 32);
    const decoded = base64.decode(encoded);
    const [ivBase64, encryptedText] = decoded.split("::");
    const iv = Buffer.from(ivBase64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key), iv);
    let decrypted = decipher.update(encryptedText, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return unpad(decrypted);
}

module.exports = { encrypt, decrypt };
