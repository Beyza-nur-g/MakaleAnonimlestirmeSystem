const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const { logEvent } = require("../utils/logger"); // 📌 Log fonksiyonu eklendi

// ✅ GET /api/messages?articleId=XYZ
router.get("/", async (req, res) => {
    const { articleId } = req.query;

    if (!articleId) {
        logEvent("[HATA] articleId parametresi eksik.");
        return res.status(400).json({ message: "articleId parametresi gerekli." });
    }

    try {
        const messages = await Message.find({ articleId }).sort({ timestamp: 1 });
        logEvent(`[GET] Mesajlar başarıyla getirildi. Makale ID: ${articleId}`);
        res.json(messages);
    } catch (err) {
        logEvent(`[HATA] Mesajlar getirilirken hata oluştu: ${err.message}`);
        res.status(500).json({ message: "Mesajlar getirilirken hata oluştu.", error: err });
    }
});

// ✅ POST /api/messages
router.post("/", async (req, res) => {
    const { articleId, sender, message } = req.body;

    if (!articleId || !sender || !message) {
        logEvent("[HATA] Zorunlu alanlar eksik (articleId, sender, message).");
        return res.status(400).json({ message: "Gerekli alanlar eksik." });
    }

    try {
        const newMessage = new Message({ articleId, sender, message });
        await newMessage.save();
        logEvent(`[POST] Yeni mesaj kaydedildi. Makale ID: ${articleId}, Gönderen: ${sender}`);
        res.json({ message: "Mesaj başarıyla kaydedildi." });
    } catch (err) {
        logEvent(`[HATA] Mesaj kaydedilirken hata oluştu: ${err.message}`);
        res.status(500).json({ message: "Mesaj kaydedilirken hata oluştu.", error: err });
    }
});

module.exports = router;
