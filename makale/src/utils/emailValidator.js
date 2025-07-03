// src/utils/emailValidator.js
const axios = require("axios");

async function validateEmail(email) {
    console.log("🧪 E-Posta doğrulaması başlatıldı:", email);

    const apiKey = process.env.MAILBOXLAYER_API_KEY; // .env dosyasında tanımlanmalı
    const url = `http://apilayer.net/api/check?access_key=${apiKey}&email=${email}&smtp=1&format=1`;

    try {
        const res = await axios.get(url);
        const result = res.data;
        

        console.log("📩 API Sonucu:", result); // 🔍 Gözlemle
        const isValid =
            result.format_valid === true &&
            result.smtp_check === true &&
            result.mx_found === true &&
            !result.disposable;

        console.log("✅ Doğrulama sonucu:", isValid);
        return isValid;
        

    } catch (err) {
        console.error("📡 E-posta doğrulama hatası:", err.message);
        return false; // API hatası varsa yükleme engellensin
    }
    
}

module.exports = validateEmail;
