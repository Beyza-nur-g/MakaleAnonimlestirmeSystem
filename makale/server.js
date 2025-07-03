require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path"); 

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Statik HTML Dosyalarını Sunma
app.use(express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "src/uploads")));
app.use("/anonymized", express.static(path.join(__dirname, "src/anonymized")));
app.use("/finalDocuments", express.static(path.join(__dirname, "src/finalDocuments")));
app.use("/reviewResultDocuments", express.static(path.join(__dirname, "src/reviewResultDocuments")));




app.use(cors({
    origin: "*", // 🌍 Tüm kaynaklardan erişime izin ver
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Content-Type"
}));

// MongoDB Bağlantısı
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Bağlantısı Başarılı"))
    .catch(err => console.error("❌ MongoDB Bağlantı Hatası:", err));


const articleRoutes = require("./src/routes/articleRoutes");
app.use("/api/articles", articleRoutes);

const reviewerRoutes = require("./src/routes/reviewerRoutes");
app.use("/api/reviewers", reviewerRoutes);

const editorRoutes = require("./src/routes/editorRoutes");
app.use("/api/editor", editorRoutes);

const messageRoutes = require("./src/routes/messageRoutes");
app.use("/api/message", messageRoutes);



// Sunucuyu Başlat
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Sunucu ${PORT} portunda çalışıyor`));
