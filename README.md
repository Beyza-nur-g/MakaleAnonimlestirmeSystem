# 🔐 Makale Anonimleştirme Sistemi | Secure Article Anonymization System

Akademik değerlendirme sürecinde anonimliği korumak için geliştirilen bir sistem.  
This system is developed to protect anonymity in academic article reviewing.

---

## 📌 Genel Özellikler | Key Features

- 📄 PDF belgeleri yüklenebilir
- 🤖 Otomatik kişisel bilgi tespiti (yazar adı, e-posta, kurum)
- 🔐 AES-256 şifreleme ve RSA dijital imzalama
- 🕵️‍♀️ Görsel anonimleştirme (OpenCV ile yüz bulanıklaştırma)
- 📬 E-posta doğrulama sistemi
- 👥 Rollere göre işlem (Yazar, Editör, Hakem)
- 📥 SHA-256 bütünlük kontrolü
- 🔁 Orijinal belge geri yükleme desteği (anonim metinler için)

---

## 🛠 Kullanılan Teknolojiler | Tech Stack

| Katman         | Teknoloji                              |
|----------------|-----------------------------------------|
| Frontend       | React.js                               |
| Backend        | Node.js (Express.js), Python            |
| Veri Tabanı    | MongoDB                                 |
| PDF İşleme     | PyMuPDF, pdfminer.six                   |
| Görsel İşleme  | OpenCV                                  |
| Şifreleme      | AES (cryptography), RSA (digital sign)  |
| Kimlik Doğrulama | SHA-256 & MIME kontrol                 |

---

## 🔄 Süreç Akışı | Process Flow

1. **Makale Yükleme**:  
   Yazar e-posta adresiyle PDF yükler ve sistem tarafından benzersiz `trackingNumber` oluşturulur.

2. **Anonimleştirme**:  
   Editör, sistemin tespit ettiği kişisel bilgileri inceler, karar verir, AES ile şifrelenir ve belgeye maskelenmiş olarak işlenir.

3. **Hakem Değerlendirmesi**:  
   Hakem sadece anonim PDF’i görür, değerlendirme metni SHA-256 ile özetlenir, RSA ile imzalanır.

4. **Geri Yükleme & Teslim**:  
   Editör yorumları kontrol eder, dijital imzayı doğrular, isterse anonim verileri geri yükler ve yazara son belgeyi gönderir.

---

## 📂 Proje Yapısı | Project Structure
```bash

MakaleAnonimlestirme/
├── makale/
│ ├── makale-backend/ # Express.js backend
│ ├── makale-frontend/ # React frontend
│ ├── python-script/ # PDF işleme ve anonimleştirme
│ └── README.md
```

---

## 🔒 Anonimleştirme Detayları | Anonymization Mechanics

- **Regex + NER Tabanlı Bilgi Tespiti**:
  - Yazar Adı: Dr., Prof. vb. kalıplarla
  - E-posta: Regex (RFC 5322)
  - Kurum: Named Entity Recognition (NER)

- **AES-256 ile Şifreleme**:
  - IV kullanılarak veri şifrelenir
  - metadata.json dosyasında saklanır

- **Görsel Anonimlik**:
  - İnsan yüzleri OpenCV ile tespit edilir
  - Gaussian Blur ile bulanıklaştırılır

- **SHA-256 ve RSA Dijital İmza**:
  - Hakem değerlendirmesi önce özetlenir
  - RSA özel anahtar ile imzalanır
  - Editör, SHA + açık anahtar ile doğrular

---

## 🧪 Test Süreci | Testing

- ✔️ Test PDF'lerinde 1. ve sondan bir önceki sayfada anonimleştirme başarıyla uygulanmıştır
- ✔️ Yüz tanıma testlerinde OpenCV doğru şekilde çalışmıştır
- ✔️ RSA imzası ve SHA kontrol mekanizması editör panelinde geçerliliği sağlamıştır

---

## 🔐 Güvenlik | Security

- Tüm anonim bilgiler AES ile şifrelenmiş
- Hakem metinleri SHA-256 özeti + RSA imzası ile korunur
- Görseller geri getirilemez: Gizlilik önceliklidir

---

## 🧑‍💻 Geliştirici | Developer

> **Beyza Nur Gültekin**  
> Bilgisayar Mühendisliği – Kocaeli Üniversitesi  
> 📧 beyzanurgultekin124@gmail.com

---

## 📚 Kaynaklar | References

- [Regex Nedir?](https://www.hosting.com.tr/bilgi-bankasi/regex-regular-expressions-nedir/)
- [PyMuPDF](https://pymupdf.readthedocs.io/)
- [OpenCV Docs](https://docs.opencv.org/)
- [cryptography.io](https://cryptography.io/)
- [MongoDB Docs](https://www.mongodb.com/docs/)
- [ReactJS](https://reactjs.org/)
- [ExpressJS](https://expressjs.com/)


