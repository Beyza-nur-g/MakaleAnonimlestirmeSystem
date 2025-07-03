const express = require("express");
const Article = require("../models/Article");
const Reviewer = require("../models/Reviewer");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { PDFDocument, rgb } = require("pdf-lib");
const { encrypt } = require("../utils/encryption"); // AES fonksiyonlarını buradan alalım (birazdan açıklayacağım)
const { exec } = require("child_process");
const { logEvent } = require("../utils/logger"); 
const { signComment } = require("../utils/rsa_utils"); 

const router = express.Router();

// 📌 Hakemin Eklediği Açıklamalar ile Güncellenmiş PDF'yi Kaydetme
router.post("/reviewer/submitReview", async (req, res) => {
    console.log("sumbitReview çalıştı");
    try {
        const { articleId, reviewerId, evaluation } = req.body;
        if (!articleId || !reviewerId || !evaluation) {
            return res.status(400).json({ error: "Eksik bilgiler!" });
        }

        const article = await Article.findById(articleId);
        if (!article) return res.status(404).json({ error: "Makale bulunamadı." });

        // 🔹 Hash ve Dijital İmza Oluşturma
        const hashedEvaluation = crypto.createHash("sha256").update(evaluation).digest("hex");

        const sign = crypto.createSign("SHA256");
        sign.update(hashedEvaluation);
        sign.end();
        const signature = sign.sign(RSA_PRIVATE_KEY, "hex");

        // 🔹 Veritabanına Kaydetme
        article.additionalComments = evaluation;
        article.reviewResult = "Değerlendirildi";
        await article.save();

        // 🔹 PDF'yi Aç ve Güncelle
        const anonPdfPath = article.anonPdfPath;
        const existingPdfBytes = fs.readFileSync(anonPdfPath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        // 🔹 Son Sayfayı Al ve Altına Yorum Ekle
        const pages = pdfDoc.getPages();
        const lastPage = pages[pages.length - 1];
        const fontSize = 12;
        const text = `\n--- Reviewer Comment: ---\n${evaluation}\n\nSHA-256 Hash: ${hashedEvaluation}\nDijital İmza: ${signature}`;

        const hashTxtPath = outputPath.replace(".pdf", "_review_hash.txt");
        try {
            fs.writeFileSync(hashTxtPath, hashedEvaluation);
            console.log("✅ SHA-256 hash dosyası kaydedildi:", hashTxtPath);
        } catch (err) {
            console.error("❌ Hash dosyası kaydedilemedi:", err.message);
        }

        lastPage.drawText(text, {
            x: 50,
            y: 50,
            size: fontSize,
            color: rgb(0, 0, 0)
        });

        // 🔹 PDF'yi Güncelle (Anonimleştirilmiş PDF'nin Üzerine Yaz)
        const updatedPdfBytes = await pdfDoc.save();
        fs.writeFileSync(anonPdfPath, updatedPdfBytes);
        console.log("📁 Hash TXT path:", outputPdfPath.replace(".pdf", "_review_hash.txt"));

        
        console.log("🧾 Oluşturulan SHA256 Hash:", hashedComment);
        
    
        // ✅ SHA256 hash dosyasını güvenli şekilde oluştur
        try {
           
           fs.writeFileSync(hashTxtPath, hashedComment);
           console.log("✅ SHA-256 hash dosyası kaydedildi:", hashTxtPath);
        } catch (err) {
           console.error("❌ Hash dosyası kaydedilemedi:", err.message);
        }
        

        res.json({ message: "Değerlendirme kaydedildi ve PDF güncellendi!", anonPdfPath });
    } catch (error) {
        console.error("PDF güncelleme hatası:", error);
        res.status(500).json({ error: "Sunucu hatası." });
    }
});

// 📌 Tüm Hakemleri Getir
router.get("/", async (req, res) => {
    try {
        const reviewers = await Reviewer.find();
        res.json(reviewers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 📌 Hakeme Atanan Makaleleri Getir
router.get("/articles/:reviewerId", async (req, res) => {
    try {
        const { reviewerId } = req.params;

        const articles = await Article.find({
            reviewer: reviewerId,
            status: "Hakeme Atandı"
        }).populate("reviewer");

        if (!articles.length) {
            return res.json([]);
        }

        // HTTP erişimi için PDF yolunu dönüştür
        articles.forEach(article => {
            article.pdfPath = article.pdfPath.replace(/^C:\\Users\\JARVIS\\makale\\src\\/g, "http://localhost:5000/");
        });1
        res.json(articles);
    } catch (error) {
        console.error("Makaleler getirilirken hata:", error);
        res.status(500).json({ error: error.message });
    }
});

async function appendCommentToPDF(originalPath, commentText, outputPdfPath) {
    console.log("📥 appendCommentToPDF başladı");

    const outputDir = path.dirname(outputPdfPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const existingPDFBytes = fs.readFileSync(originalPath);
    const pdfDoc = await PDFDocument.load(existingPDFBytes);
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    const hashedComment = crypto.createHash("sha256").update(commentText).digest("hex");
    const rsaSignature = signComment(commentText); // RSA imzasını al

    const commentWithMarkers =
        `--- Reviewer Comment START ---\n${commentText}\n--- Reviewer Comment END ---\n` +
        `--- SIGNATURE START ---\n${rsaSignature}\n--- SIGNATURE END ---`;

    page.drawText("Reviewer Comment:", {
        x: 50,
        y: height - 50,
        size: 16,
        color: rgb(0, 0, 0),
    });

    const wrappedText = commentWithMarkers.match(/.{1,100}/g) || [];
    wrappedText.forEach((line, i) => {
        page.drawText(line, {
            x: 50,
            y: height - 80 - i * 20,
            size: 11,
            color: rgb(0.2, 0.2, 0.2),
        });
    });

    page.drawText(`\nSHA-256 Hash: ${hashedComment}`, {
        x: 50,
        y: 100,
        size: 10,
        color: rgb(1, 0, 0),
    });

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPdfPath, pdfBytes);

    // 🔐 Hash dosyası kaydı
    const hashTxtPath = outputPdfPath.replace(".pdf", "_review_hash.txt");
    fs.writeFileSync(hashTxtPath, hashedComment);

    // ✅ SHA256 hash dosyasını güvenli şekilde oluştur
    try {
       
       fs.writeFileSync(hashTxtPath, hashedComment);
       console.log("✅ PDF oluşturuldu ve imza eklendi:", outputPdfPath);
       console.log("✅ SHA-256 hash dosyası kaydedildi:", hashTxtPath);
    } catch (err) {
       console.error("❌ Hash dosyası kaydedilemedi:", err.message);
    }
}


// 📌 Hakem Değerlendirme Kaydı
router.post("/evaluate", async (req, res) => {
    try {
        const { articleId, reviewerId, reviewResult, additionalComments } = req.body;

        if (!articleId || !reviewerId || !reviewResult) {
            return res.status(400).json({ error: "Tüm alanlar gereklidir!" });
        }

        const article = await Article.findById(articleId);
        if (!article) return res.status(404).json({ error: "Makale bulunamadı!" });

        const originalPdfPath = path.resolve(__dirname, "..", article.anonPdfPath.replace(/^\//, ""));
        const outputPdfPath = path.resolve(__dirname, "..", "reviewResultDocuments", `reviewResult_${article.trackingNumber}.pdf`);


        await appendCommentToPDF(originalPdfPath, additionalComments || "No comments.", outputPdfPath);

        // 📌 Veritabanına yeni PDF yolunu kayıt et (anonPdfPath olarak!)
        article.status = "Değerlendirildi";
        article.reviewResult = reviewResult;
        article.additionalComments = additionalComments || "Yorum eklenmedi.";
        article.anonPdfPath = `/reviewResultDocuments/reviewResult_${article.trackingNumber}.pdf`;
        await article.save();
        

        res.json({ message: "Değerlendirme kaydedildi", anonPdfPath: article.anonPdfPath });
        logEvent(`hakem değerlendirmesi kaydedildi : ${article.trackingNumber}`);

    } catch (error) {
        console.error("❌ Hata:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
