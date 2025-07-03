import os
import re
import json
import base64
import fitz  # PyMuPDF
import hashlib
from datetime import datetime
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
import spacy
import cv2
import numpy as np
from pdf2image import convert_from_path
import tempfile
import rsa

# === AES Yardımcı Fonksiyonlar ===
def pad(s):
    return s + (chr(16 - len(s.encode()) % 16) * (16 - len(s.encode()) % 16))

def unpad(s):
    return s[:-ord(s[-1])]

def encrypt(text, key):
    key = key.ljust(32)[:32].encode("utf-8")
    iv = get_random_bytes(16)
    cipher = AES.new(key, AES.MODE_CBC, iv)
    encrypted = cipher.encrypt(pad(text).encode("utf-8"))
    return base64.b64encode(iv + encrypted).decode("utf-8")

def decrypt(enc_text, key):
    key = key.ljust(32)[:32].encode("utf-8")
    data = base64.b64decode(enc_text)
    iv, enc = data[:16], data[16:]
    cipher = AES.new(key, AES.MODE_CBC, iv)
    return unpad(cipher.decrypt(enc).decode("utf-8"))


# === NER Modeli ===
nlp = spacy.load("en_core_web_sm")

def is_target_page(index, total):
    return index == 0 or index == total - 2

def split_paragraphs(text, skip_keywords):
    skip_patterns = [re.escape(kw) for kw in skip_keywords]
    split_pattern = r"\n{2,}|\n(?=" + "|".join(skip_patterns) + r")"
    raw_paragraphs = re.split(split_pattern, text)
    return [p.strip() for p in raw_paragraphs if p.strip()]


def extract_entities(text, options, known_entities=None):
    doc = nlp(text)
    entities = []
    known_entities = known_entities or {"NAME": [], "EMAIL": [], "INSTITUTION": []}

    # Skip keyword'ler (başlık gibi) — bunlardan sonra gelen paragraf kısımları atlanacak
    skip_keywords = [
        "abstract", "introduction", "related work", "results", "index terms",
        "conclusion", "discussion", "references", "acknowledgment", "thank", "summary"
    ]
    skip_keywords = [kw.lower() for kw in skip_keywords]

    # Teknik terimleri filtrelemek için kara liste
    blacklist_keywords = {
         # EEG ve duygu işleme ile ilgili
          "eeg", "emg", "ecg", "emotion", "valence", "arousal", "stimulus", "affective", "deap", "seed", "dens",

         # Derin öğrenme / Yapay zeka
         "cnn", "lstm", "rnn", "gan", "transformer", "bert", "gpt", "resnet", "autoencoder",
         "vae", "unet", "fasttext", "xgboost", "svm", "knn", "decision tree", "random forest",
    
          # Veri işleme / görselleştirme / büyük veri
         "dataset", "features", "signal", "sensor", "preprocessing", "visualization",
         "hadoop", "spark", "pandas", "numpy", "matplotlib", "scikit", "sklearn",

          # AR/VR / HCI
         "vr", "ar", "virtual reality", "augmented reality", "headset", "interface", "hci",

         # Güvenlik / kriptografi
         "encryption", "hash", "sha256", "rsa", "aes", "blockchain", "authentication", "cybersecurity", "privacy",

         # Dağıtık sistemler
         "5g", "cloud", "p2p", "distributed", "container", "docker", "kubernetes", "microservice",

         # Bilimsel terimler
          "accuracy", "precision", "recall", "f1", "auc", "loss", "epoch", "cross entropy", "optimizer", "gradient"
    }    

    # Varlık bağlamı için anahtar kelimeler
    context_keywords = {
        "NAME": [
            "author", "corresponding", "written by", "professor", "dr.", "mr.", "ms.", "mrs.", "phd", "msc",
            "supervised", "advisor", "writer", "editor", "presented by", "submitted by", "researcher",
            "graduate student", "contributor", "lead", "principal investigator", "pi", "reviewed by",
            
       ],
        "INSTITUTION": [
            "university", "institute", "department", "faculty", "school", "college", "organization",
            "lab", "centre", "center", "research", "affiliation", "campus", "technology", "division",
            "unit", "company", "corporation", "society", "office", "foundation", "laboratory",
          "academy", "association", "bureau", "ministry", "faculty of engineering", "technical institute",
          "member", "senior", "intern", "company", "corporation", "group", "team", "academy","engineering"
       ]
    }

    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]

    for para in paragraphs:
        original_para = para  # filtrelenmemiş tam paragraf
        para_lower = para.lower()

        # Eğer bir skip keyword içeriyorsa, o kelimeden sonrası atlanmalı
        for kw in skip_keywords:
            idx = para_lower.find(kw)
            if idx != -1:
                para = para[:idx].strip()
                para_lower = para.lower()
                break

        if not para.strip():
            continue

        sub_doc = nlp(para)

        def is_in_context(ent_text, tag):
            for match in re.finditer(re.escape(ent_text), para, re.IGNORECASE):
                start, end = match.start(), match.end()
                window = para[max(0, start - 300):min(len(para), end + 300)].lower()
                return any(kw in window for kw in context_keywords.get(tag, []))

        # 💡 Manuel yazar adı (büyük harfli)
        if options.get("name"):
            for line in para.split("\n"):
                line_clean = line.strip()
                if (
                    line_clean.isupper() and
                    2 <= len(line_clean.split()) <= 12 and
                    any(c.isalpha() for c in line_clean)
                ):
                    entities.append(("NAME", line_clean))
                    known_entities["NAME"].append(line_clean)

            for ent in sub_doc.ents:
                if ent.label_ == "PERSON" and len(ent.text.split()) >= 2:
                    if is_in_context(ent.text, "NAME") and ent.text.lower() not in blacklist_keywords:
                        entities.append(("NAME", ent.text))
                        known_entities["NAME"].append(ent.text)

        if options.get("email"):
            for match in re.finditer(r"[\w\.-]+@[\w\.-]+", para):
                email = match.group()
                if email.lower() not in blacklist_keywords:
                    entities.append(("EMAIL", email))
                    known_entities["EMAIL"].append(email)

        if options.get("institution"):
            for ent in sub_doc.ents:
                if ent.label_ == "ORG":
                    if is_in_context(ent.text, "INSTITUTION") and ent.text.lower() not in blacklist_keywords:
                        entities.append(("INSTITUTION", ent.text))
                        known_entities["INSTITUTION"].append(ent.text)

        # Önceden bilinen varlıkları yeniden ekle (paragrafta varsa)
        for tag in ["NAME", "EMAIL", "INSTITUTION"]:
            for val in known_entities.get(tag, []):
                if val.lower() in original_para.lower() and (tag, val) not in entities:

                    entities.append((tag, val))

    return list(set(entities)), known_entities




def log_event(message, path="logs/anonim_log.txt"):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(f"[{datetime.now()}] {message}\n")

def encrypt_image(np_img, key):
    flat = np_img.flatten()
    pad_len = 16 - (flat.nbytes % 16)
    padded = np.pad(flat, (0, pad_len), mode='constant')
    cipher = AES.new(key.ljust(32)[:32].encode('utf-8'), AES.MODE_CBC, iv := get_random_bytes(16))
    encrypted = cipher.encrypt(padded.tobytes())
    return base64.b64encode(iv + encrypted).decode('utf-8'), np_img.shape, pad_len


def decrypt_image(enc_data, shape, pad_len, key):
    data = base64.b64decode(enc_data)
    iv, encrypted = data[:16], data[16:]
    cipher = AES.new(key.ljust(32)[:32].encode('utf-8'), AES.MODE_CBC, iv)
    decrypted = cipher.decrypt(encrypted)
    flat = np.frombuffer(decrypted[:-pad_len], dtype=np.uint8)
    return flat.reshape(shape)


def blur_images_with_faces(input_pdf, output_pdf, key="defaultkey123"):
    try:
        article_id_match = re.search(r'MKL-(\d+)', output_pdf)
        article_id = article_id_match.group(1) if article_id_match else "unknown"
        image_meta_path = os.path.join("face_metadata", f"image_metadata_MKL-{article_id}.json")
        os.makedirs(os.path.dirname(image_meta_path), exist_ok=True)

        images = convert_from_path(input_pdf)
        doc = fitz.open(input_pdf)
        new_doc = fitz.open()
        image_metadata = []

        for i, img in enumerate(images):
            np_img = np.array(img)
            gray = cv2.cvtColor(np_img, cv2.COLOR_RGB2GRAY)

            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
            faces = face_cascade.detectMultiScale(gray, 1.3, 5)

            for (x, y, w, h) in faces:
                face = np_img[y:y+h, x:x+w]
                encrypted_data, shape, pad_len = encrypt_image(face, key)
                blurred_face = cv2.GaussianBlur(face, (99, 99), 30)
                np_img[y:y+h, x:x+w] = blurred_face
                image_metadata.append({
                    "page": int(i),
                    "coords": [int(x), int(y), int(w), int(h)],
                    "enc": encrypted_data,
                    "shape": [int(s) for s in shape],
                    "pad_len": int(pad_len)
                })

            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_img:
                cv2.imwrite(temp_img.name, cv2.cvtColor(np_img, cv2.COLOR_RGB2BGR))
                temp_img_path = temp_img.name

            new_page = new_doc.new_page(width=doc[i].rect.width, height=doc[i].rect.height)
            new_page.insert_image(new_page.rect, filename=temp_img_path)
            os.remove(temp_img_path)

        new_doc.save(output_pdf)
        new_doc.close()

        with open(image_meta_path, "w", encoding="utf-8") as f:
            json.dump(image_metadata, f, indent=2)

        # Doğrulama amaçlı tekrar aç
        with open(image_meta_path, "r", encoding="utf-8") as f:
            json.load(f)

    except Exception as e:
        log_event(f"[HATA] Görsel blur + şifreleme başarısız: {str(e)}")



def restore_faces_from_encrypted(output_pdf, key="defaultkey123"):
    try:
        article_id_match = re.search(r'MKL-(\d+)', output_pdf)
        article_id = article_id_match.group(1) if article_id_match else "unknown"
        image_meta_path = os.path.join("face_metadata", f"image_metadata_MKL-{article_id}.json")

        if not os.path.exists(image_meta_path):
            log_event("[HATA] Yüz geri yükleme metadata dosyası bulunamadı.")
            return

        doc = fitz.open(output_pdf)
        images = convert_from_path(output_pdf)
        with open(image_meta_path, "r") as f:
            image_metadata = json.load(f)

        new_doc = fitz.open()
        for i, img in enumerate(images):
            np_img = np.array(img)

            for meta in image_metadata:
                if meta["page"] == i:
                    x, y, w, h = meta["coords"]
                    restored = decrypt_image(meta["enc"], tuple(meta["shape"]), meta["pad_len"], key)
                    np_img[y:y+h, x:x+w] = restored

            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_img:
                cv2.imwrite(temp_img.name, cv2.cvtColor(np_img, cv2.COLOR_RGB2BGR))
                temp_img_path = temp_img.name

            new_page = new_doc.new_page(width=doc[i].rect.width, height=doc[i].rect.height)
            new_page.insert_image(new_page.rect, filename=temp_img_path)
            os.remove(temp_img_path)
        doc.close()
        new_doc.save(output_pdf)
        new_doc.close()
        log_event(f"Gizli yüzler başarıyla geri getirildi: {output_pdf}")
    except Exception as e:
        log_event(f"[HATA] Şifreli yüz geri alma başarısız: {str(e)}")


def anonymize(input_pdf, output_pdf, options, key):
    doc = fitz.open(input_pdf)
    total = len(doc)
    metadata = []
    known_entities = {"NAME": [], "EMAIL": [], "INSTITUTION": []}

    for i, page in enumerate(doc):
        if not is_target_page(i, total + 1):
            continue

        text = page.get_text()
        found, known_entities = extract_entities(text, options, known_entities)

        # Yazı özelliklerini almak için
        text_dict = page.get_text("dict")
        spans = [
            span for block in text_dict["blocks"]
            if "lines" in block
            for line in block["lines"]
            for span in line["spans"]
        ]

        for tag, original in found:
            if not original.strip():
                continue

            encrypted = encrypt(original, key)
            masked = "*" * len(original)

            matched_rects = page.search_for(original)
            if not matched_rects:
                log_event(f"[WARN] '{original}' metni sayfada bulunamadı. Atlandı.")
                continue

            for rect in matched_rects:
                matching_span = next(
                    (s for s in spans if original in s["text"] and abs(s["bbox"][0] - rect.x0) < 1 and abs(s["bbox"][1] - rect.y0) < 1),
                    None
                )

                fontname = matching_span["font"] if matching_span else "helv"
                fontsize = matching_span["size"] if matching_span else 10
                color = (1, 0, 0) 

                # ✅ Önce beyaz dikdörtgenle gizle
                page.add_redact_annot(rect, fill=(1, 1, 1))

                # 📝 Metadata bilgisi
                metadata.append({
                    "page": i,
                    "tag": tag,
                    "original": original,
                    "encrypted": encrypted,
                    "coordinates": [rect.x0, rect.y0, rect.x1, rect.y1],
                    "fontsize": fontsize,
                    "fontname": fontname,
                    "color": color
                })

                # 📌 Not: `insert_text` değil, textbox ile hizalama yapıyoruz
                page.insert_textbox(
                    rect,
                    masked,
                    fontsize=fontsize,
                    fontname=fontname if fontname.lower() in {"helv", "times", "courier"} else "helv",
                    color=color,
                    align=0
                )

        # ✅ Tüm annot’lar eklendikten sonra redaksiyonu uygula
        page.apply_redactions()

    doc.save(output_pdf)
    doc.close()

    meta_path = output_pdf.replace(".pdf", "_metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=4, ensure_ascii=False)

    temp_output = output_pdf.replace(".pdf", "_blurred.pdf")
    blur_images_with_faces(output_pdf, temp_output)
    os.remove(output_pdf)
    os.rename(temp_output, output_pdf)

    log_event(f"Anonimleştirme tamamlandı: {output_pdf}")




def de_anonymize(input_pdf, output_pdf, key, original_path):

    # MKL ID'sini dosya adından al
    filename = os.path.basename(input_pdf)
    match = re.search(r"MKL-(\d+)", filename)
    tracking_id = match.group(1) if match else None

    # Doğru isimli hash dosyasını oluştur
    if tracking_id:
        hash_filename = f"reviewResult_MKL-{tracking_id}_review_hash.txt"
        hash_path = os.path.join("src", "reviewResultDocuments", hash_filename)
    else:
        hash_path = input_pdf.replace(".pdf", "_review_hash.txt")

    if not os.path.exists(hash_path):
        log_event(f"SHA256 hash dosyası bulunamadı: {hash_path}. İşlem iptal.")
        return

    with open(hash_path, "r") as f:
        original_hash = f.read().strip()

    if 'doc' in locals():
       doc.close()

    doc = fitz.open(input_pdf)
    last_page_text = doc[-1].get_text()
    
    match = re.search(r'--- Reviewer Comment START ---[\r\n]+(.*?)[\r\n]+--- Reviewer Comment END ---', last_page_text, re.DOTALL)

    if not match:
        log_event("Yorum bölgesi bulunamadı. İşlem iptal.")
        return

    extracted_comment = match.group(1).strip()
    current_hash = hashlib.sha256(extracted_comment.encode("utf-8")).hexdigest()

    if current_hash != original_hash:
        log_event("[ENGELLENDİ] Hakem yorumu değiştirildi, işlem iptal.")
        return

    base_name = os.path.splitext(os.path.basename(input_pdf))[0]
    article_id_match = re.search(r'MKL-(\d+)', base_name)
    article_id = article_id_match.group(1) if article_id_match else ""

    meta_path_candidates = [
        input_pdf.replace(".pdf", "_metadata.json"),
        os.path.join("src", "anonymized", f"{base_name}_metadata.json"),
        os.path.join("src", "anonymized", f"anonymized_MKL-{article_id}_metadata.json")
    ]

    meta_path = next((p for p in meta_path_candidates if os.path.exists(p)), None)
    if not meta_path:
        log_event("Metadata bulunamadı.")
        return

    with open(meta_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    doc = fitz.open(input_pdf)    

    for item in metadata:
        page = doc[item["page"]]
        coords = item["coordinates"]
        rect = fitz.Rect(coords)
        rect.y0 += 10  # 🔽 De-anonimleştirme sırasında biraz aşağı kaydır
        rect.y1 += 10
        
        decrypted = decrypt(item["encrypted"], key).strip()

        if not decrypted or rect.is_empty:
           log_event(f"[SKIP] Boş veri ya da geçersiz rect: {coords}")
           continue

        page.add_redact_annot(rect, fill=(1, 1, 1))
        page.apply_redactions()

        #page.insert_textbox(rect, decrypted, fontsize=10, color=(0, 0, 1), align=0)
        page.insert_text((rect.x0, rect.y0), decrypted, fontsize=10, color=(0, 0, 0))

    

    
    os.makedirs(os.path.dirname(output_pdf), exist_ok=True)
    try:
        doc.save(output_pdf)
        log_event(f"De-anonimleştirme tamamlandı: {output_pdf}")
        if original_path and os.path.exists(original_path):
           restore_faces_from_encrypted(output_pdf, key=key)

        else:
           log_event("Orijinal PDF bulunamadı. Yüzler geri yüklenemedi.")
    except Exception as e:
        log_event(f"[HATA] PDF kaydedilemedi: {str(e)}")
    finally:
        doc.close()


  

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 4:
        print("Kullanım: python anonymizer.py <mod> <girdi.pdf> <çıkış.pdf> [options_base64]")
        exit()

    mod, input_path, output_path = sys.argv[1:4]
    key = os.getenv("AES_SECRET_KEY", "defaultkey123")

    if mod == "anonymize":
        if len(sys.argv) < 5:
            print("Anonimleştirme için options parametresi gerekli!")
            exit()
        decoded = base64.b64decode(sys.argv[4]).decode("utf-8")
        options = json.loads(decoded)
        anonymize(input_path, output_path, options, key)
    elif mod == "de_anonymize":
            original_path = sys.argv[4]
            de_anonymize(input_path, output_path, key, original_path)
    else:
        print("Mod geçersiz. Kullan: anonymize | de_anonymize")