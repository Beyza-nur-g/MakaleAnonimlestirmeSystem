const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const Article = require("../models/Article");

const router = express.Router();

// 📌 Dosyaların kaydedileceği dizin belirleme
const uploadDir = path.join(__dirname, "../uploads/");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 📌 Multer ile dosya yükleme ayarları
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage });
const validateEmail = require("../utils/emailValidator"); // yeni eklenen modül

router.post("/upload", upload.single("pdf"), async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !req.file) {
            return res.status(400).json({ message: "❌ E-posta ve PDF dosyası gereklidir." });
        }

        // 📌 E-Posta Gerçeklik Kontrolü
        const isValid = await validateEmail(email);
        console.log("🔍 E-Posta kontrol sonucu:", isValid);

        if (!isValid) {
            return res.status(400).json({ message: "❌ Geçersiz veya ulaşılamayan e-posta adresi." });
        }

        const trackingNumber = "MKL-" + Date.now();
        const pdfFilename = req.file.filename;
        const pdfPath = `/uploads/${pdfFilename}`;

        // 📌 NLP İşleme
        exec(`python nlp_processor.py "${req.file.path}"`, async (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Python NLP Hatası: ${error.message}`);
                return res.status(500).json({ message: "❌ NLP işlenirken hata oluştu." });
            }

            if (stderr) {
                console.warn(`⚠️ Python STDERR: ${stderr}`);
            }

            let nlpResult;
            try {
                nlpResult = JSON.parse(stdout);
            } catch (parseError) {
                console.error("❌ JSON Parse Hatası:", parseError);
                return res.status(500).json({ message: "❌ Konuyu belirlerken hata oluştu." });
            }

            // 📌 Yeni makale kaydetme
            const newArticle = new Article({
                trackingNumber,
                email,
                pdfPath, // ✅ Windows yolu yerine HTTP uyumlu yol kaydediliyor
                articleTopic: nlpResult.topic
            });

            await newArticle.save();
            return res.status(201).json({ 
                message: "✅ Makaleniz başarıyla yüklendi.",
                trackingNumber,
                pdfPath, // Kullanıcıya HTTP uyumlu yolu döndür
                detectedLanguage: nlpResult.language,
                topic: nlpResult.topic
            });
            
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "❌ Makale yüklenirken hata oluştu." });
    }
});
// 📌 Makale Durumu Sorgulama (GET /api/articles/status?trackingNumber=...&email=...)
router.get("/status", async (req, res) => {
    try {
        const { trackingNumber, email } = req.query;

        if (!trackingNumber || !email) {
            return res.status(400).json({ message: "Makale takip numarası ve e-posta gereklidir." });
        }

        const article = await Article.findOne({ trackingNumber, email });

        if (!article) {
            return res.status(404).json({ message: "Böyle bir makale bulunamadı." });
        }

        res.json(article);
    } catch (error) {
        console.error("Makale sorgulama hatası:", error);
        res.status(500).json({ message: "Sunucu hatası, lütfen tekrar deneyin." });
    }
});


module.exports = router;
