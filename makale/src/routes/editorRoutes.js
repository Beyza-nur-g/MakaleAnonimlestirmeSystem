const express = require("express");
const Article = require("../models/Article");
const Reviewer = require("../models/Reviewer");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const AES_SECRET_KEY = process.env.AES_SECRET_KEY || "default_secret_key";
const crypto = require("crypto");
const { PDFDocument } = require("pdf-lib");
const pdfParse = require("pdf-parse");
const { logEvent } = require("../utils/logger"); 




const router = express.Router();


function encryptText(text, key) {
    const cipher = crypto.createCipher("aes-256-cbc", key);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
}

function decryptText(encryptedText, key) {
    const decipher = crypto.createDecipher("aes-256-cbc", key);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}
router.post("/anonymize", async (req, res) => {
    const { articleId, options } = req.body;
    const article = await Article.findById(articleId);
    const inputPath = path.join(__dirname, "..", article.pdfPath);
    const outputPath = path.join(__dirname, "..", "anonymized", `anonymized_${article.trackingNumber}.pdf`);
    const optionsStr = JSON.stringify(options).replace(/"/g, '\\"');

    const rawOptions = JSON.stringify(options);
    const encodedOptions = Buffer.from(rawOptions).toString("base64");

    const command = `python anonymizer.py anonymize "${inputPath}" "${outputPath}" "${encodedOptions}"`;

    exec(command, async (error, stdout, stderr) => {
        console.log("🔁 Çalıştırılan Komut:", command);
        if (error) {
            console.error("❌ Python Hatası:", error.message);
            return res.status(500).json({ error: "Python çalıştırılamadı", detay: error.message });
        }
        if (stderr) console.warn("⚠️ stderr:", stderr);
        if (stdout) console.log("✅ stdout:", stdout);
    
        if (!fs.existsSync(outputPath)) {
            return res.status(500).json({ error: "Anonimleştirme başarılı gibi görünüyor ama PDF oluşturulmamış!" });
        }
    
        article.anonPdfPath = `/anonymized/anonymized_${article.trackingNumber}.pdf`;
        await article.save();
        res.json({ message: "Anonimleştirme tamamlandı", path: article.anonPdfPath });
    });
    
});
// 📌 Anonimlik Kaldırma ve Hakem Yorumunu Koruma
router.post("/decryptAnonymized", async (req, res) => {
    try {
        
        const { articleId } = req.body;
        console.log("📥 Gelen articleId:", articleId);

        const article = await Article.findById(articleId);
        if (!article) return res.status(404).json({ error: "Makale bulunamadı." });
        if (!article.anonPdfPath) return res.status(400).json({ error: "Anonimleştirilmiş dosya mevcut değil." });

        // 📁 Girdi ve çıktı yollarını hazırla
        const inputPath = path.join(__dirname, "..", article.anonPdfPath);
        const outputPath = path.join(__dirname, "..", "finalDocuments", `final_${article.trackingNumber}.pdf`);
        const originalPath = path.join(__dirname, "..", article.pdfPath); 

        const command = `python anonymizer.py de_anonymize "${inputPath}" "${outputPath}" "${originalPath}"`;

        console.log("🔁 Python Komutu:", command);

        exec(command, async (error, stdout, stderr) => {
            console.log("✅ stdout:", stdout);
            console.error("⚠️ stderr:", stderr);
            if (error) {
                console.error("❌ Python Hatası:", error.message);
                return res.status(500).json({ error: "Python çalıştırılamadı", detay: error.message });
            }

            if (!fs.existsSync(outputPath)) {
                console.error("❌ PDF kaydedilemedi!");
                return res.status(500).json({ error: "De-anonimleştirilmiş PDF oluşturulamadı!" });
            }

            // 📁 Başarıyla tamamlandı
            article.pdfPath = `/finalDocuments/final_${article.trackingNumber}.pdf`;
            await article.save();

            console.log("✅ De-anonimleştirme ve doğrulama tamamlandı.");
            res.json({ message: "Anonimlik başarıyla kaldırıldı!", pdfPath: article.pdfPath });
        });

    } catch (error) {
        console.error("💥 Sunucu hatası:", error);
        res.status(500).json({ error: "Sunucu hatası." });
    }
});

// 📌 HAKEM EKLEME (POST /api/editor/addReviewer)
router.post("/addReviewer", async (req, res) => {
    try {
        const { name, expertise } = req.body;

        // 📌 Eksik alan kontrolü
        if (!name || !expertise) {
            return res.status(400).json({ error: "Hakem adı ve uzmanlık alanı gereklidir!" });
        }

        // 📌 Aynı isimde hakem var mı kontrol et
        const existingReviewer = await Reviewer.findOne({ name });
        if (existingReviewer) {
            return res.status(400).json({ error: "Bu isimde bir hakem zaten mevcut!" });
        }

        // 📌 Yeni hakemi oluştur ve kaydet
        const newReviewer = new Reviewer({ name, expertise });
        await newReviewer.save();

        res.json({ message: "Hakem başarıyla eklendi!", reviewer: newReviewer });
    } catch (error) {
        console.error("Hakem eklenirken hata oluştu:", error);
        res.status(500).json({ error: error.message });
    }
});

// 📌 2) Makaleleri Status'a Göre Getirme (GET /api/editor/articles)
router.get("/articles", async (req, res) => {
    try {
        const { status } = req.query;
        const query = status ? { status } : {};
        const articles = await Article.find(query).populate("reviewer");
        res.json(articles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 📌 3) Konuya Göre Hakemleri Getirme (GET /api/editor/reviewers)
router.get("/reviewers", async (req, res) => {
    try {
        const { topic } = req.query;
        let reviewers = [];

        if (topic) {
            // Önce yalnızca aynı uzmanlık alanına sahip hakemleri getir
            reviewers = await Reviewer.find({ expertise: topic });
            
            // Eğer hiç uygun hakem bulunamazsa, tüm hakemleri getir
            if (reviewers.length === 0) {
                reviewers = await Reviewer.find();
            }
        } else {
            reviewers = await Reviewer.find();
        }

        res.json(reviewers);
    } catch (error) {
        console.error("Hakem Getirme Hatası:", error);
        res.status(500).json({ error: "Sunucu hatası." });
    }
});



// 📌 4) Makaleye Hakem Atama (POST /api/editor/assignReviewer)
router.post("/assignReviewer", async (req, res) => {
    try {
        const { articleId, reviewerId } = req.body;

        if (!articleId || !reviewerId) {
            return res.status(400).json({ error: "Makale ve hakem seçmelisiniz!" });
        }

        const article = await Article.findById(articleId);
        if (!article) return res.status(404).json({ error: "Makale bulunamadı!" });

        article.reviewer = reviewerId;
        article.status = "Hakeme Atandı";
        await article.save();

        res.json({ message: "Hakem atandı!", article });
        logEvent(`Hakem atandı: ${article.trackingNumber}`);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 📌 5) Hakem Değiştirme (POST /api/editor/changeReviewer)
router.post("/changeReviewer", async (req, res) => {
    try {
        const { articleId, newReviewerId } = req.body;

        if (!articleId || !newReviewerId) {
            return res.status(400).json({ error: "Makale ve yeni hakem seçmelisiniz!" });
        }

        const article = await Article.findById(articleId);
        if (!article) return res.status(404).json({ error: "Makale bulunamadı!" });

        article.reviewer = newReviewerId;
        await article.save();

        res.json({ message: "Hakem değiştirildi!", article });
        logEvent(`hakem değiştirildi: ${article.trackingNumber}`);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 📌 6) Makale Onaylama / Reddetme (POST /api/editor/updateStatus)
router.post("/updateStatus", async (req, res) => {
    try {
        const { articleId, newStatus } = req.body;

        if (!articleId || !newStatus) {
            return res.status(400).json({ error: "Makale ve yeni durum seçmelisiniz!" });
        }

        const article = await Article.findById(articleId);
        if (!article) return res.status(404).json({ error: "Makale bulunamadı!" });

        article.status = newStatus;
        await article.save();

        res.json({ message: "Makale durumu güncellendi!", article });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// 📌 Hakeme Makale Gönderme API
router.get("/reviewer/view/:articleId", async (req, res) => {
    try {
        const article = await Article.findById(req.params.articleId);
        if (!article) {
            return res.status(404).json({ error: "Makale bulunamadı." });
        }

        // Hakem yalnızca anonimleştirilmiş makaleyi görebilir
        if (!article.anonPdfPath) {
            return res.status(404).json({ error: "Anonimleştirilmiş makale mevcut değil." });
        }

        const decryptedPath = decryptText(article.anonPdfPath, AES_SECRET_KEY);
        res.json({ anonPdfPath: decryptedPath });
    } catch (error) {
        res.status(500).json({ error: "Sunucu hatası." });
    }
});

// 📌 Hakem Değerlendirmeleri Şifreleme
router.post("/reviewer/submitEvaluation", async (req, res) => {
    try {
        const { articleId, reviewerId, evaluation } = req.body;
        if (!articleId || !reviewerId || !evaluation) {
            return res.status(400).json({ error: "Eksik bilgiler!" });
        }

        const article = await Article.findById(articleId);
        if (!article) {
            return res.status(404).json({ error: "Makale bulunamadı." });
        }

        const hashedEvaluation = crypto.createHash("sha256").update(evaluation).digest("hex");
        article.evaluation = hashedEvaluation;
        await article.save();

        res.json({ message: "Değerlendirme kaydedildi!" });
    } catch (error) {
        res.status(500).json({ error: "Sunucu hatası." });
    }
});


module.exports = router;
