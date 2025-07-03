const mongoose = require("mongoose");

const ArticleSchema = new mongoose.Schema({
    trackingNumber: { type: String, unique: true, required: true },
    email: { type: String, required: true },
    pdfPath: { type: String, required: true }, // Orijinal PDF
    anonPdfPath: { type: String, default: null }, // 🔹 Anonimleştirilmiş PDF dosyası için
    articleTopic: { type: String, required: true, default: "Bilinmeyen Konu" },
    status: { 
        type: String, 
        enum: ['Hakem Bekleniyor', 'Hakeme Atandı', 'Değerlendirildi', 'Onaylandı', 'Reddedildi'], 
        default: "Hakem Bekleniyor" 
    },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'Reviewer', default: null },
    reviewResult: { 
        type: String, 
        enum: ['Beklemede', 'Hakem Onayladı', 'Hakem Reddetti'], 
        default: "Beklemede" 
    },
    additionalComments: { type: String, default: "" },
    submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Article", ArticleSchema);
