const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const rsa = require("node-rsa");

function signComment(commentText) {
    const privateKeyPath = path.resolve(__dirname, "rsa_keys", "private.pem");
    const privateKeyData = fs.readFileSync(privateKeyPath, "utf-8");
    const key = new rsa(privateKeyData);
    const signature = key.sign(commentText, "hex", "utf8");
    return signature;
}

function verifySignature(commentText, signatureHex) {
    const publicKeyPath = path.resolve(__dirname, "rsa_keys", "public.pem");
    const publicKeyData = fs.readFileSync(publicKeyPath, "utf-8");
    const key = new rsa(publicKeyData);
    return key.verify(commentText, Buffer.from(signatureHex, "hex"));
}

module.exports = { signComment, verifySignature };
