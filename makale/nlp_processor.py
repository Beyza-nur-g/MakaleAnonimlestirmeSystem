import pdfplumber
import sys
import json
from langdetect import detect
from transformers import pipeline

# PDF'ten metin çıkartan fonksiyon
def extract_text_from_pdf(pdf_path):
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text += page.extract_text() + "\n" if page.extract_text() else ""
    return text.strip()

# NLP modeli ile konu tahmini yapan fonksiyon
def detect_topic(text, language):
    if not text:
        return "Konu belirlenemedi."

    # İngilizce ve Türkçe için aynı modeli kullanıyoruz (zero-shot-classification)
    model_name = "facebook/bart-large-mnli"

    classifier = pipeline("zero-shot-classification", model=model_name)

    # Konu kategorileri (Genişletilebilir)
    candidate_labels = [
        # Yapay Zeka ve Makine Öğrenimi
        "Derin öğrenme", "Doğal dil işleme", "Bilgisayarla görü", "Generatif yapay zeka",
        # İnsan-Bilgisayar Etkileşimi
        "Beyin-bilgisayar arayüzleri", "Kullanıcı deneyimi tasarımı", "Artırılmış gerçeklik", "Sanal gerçeklik",
        # Büyük Veri ve Veri Analitiği
        "Veri madenciliği", "Veri görselleştirme", "Veri işleme sistemleri", "Zaman serisi analizi",
        # Siber Güvenlik
        "Şifreleme algoritmaları", "Güvenli yazılım geliştirme", "Ağ güvenliği", "Kimlik doğrulama sistemleri", "Adli bilişim",
        # Ağ ve Dağıtık Sistemler
        "5G", "Bulut bilişim", "Blockchain", "P2P sistemler"
    ]

    # Modeli çalıştır
    result = classifier(text[:1024], candidate_labels)

    # En yüksek olasılıklı konuyu döndür
    return result["labels"][0]

if __name__ == "__main__":
    pdf_path = sys.argv[1]  # Node.js'den gelen PDF yolu
    text = extract_text_from_pdf(pdf_path)
    detected_language = detect(text)

    topic = detect_topic(text, detected_language)

    output = {
        "language": "Türkçe" if detected_language == "tr" else "İngilizce",
        "topic": topic
    }

    print(json.dumps(output))
