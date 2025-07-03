import React, { useState } from "react";
import axios from "axios";

const UploadArticle = () => {
    const [email, setEmail] = useState("");
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState("");
    const [trackingNumber, setTrackingNumber] = useState("");

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!email || !file) {
            setMessage("Lütfen e-posta adresinizi girin ve bir PDF yükleyin.");
            return;
        }

        const formData = new FormData();
        formData.append("email", email);
        formData.append("pdf", file);

        try {
            const response = await axios.post("http://localhost:5000/api/articles/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            setTrackingNumber(response.data.trackingNumber);
            setMessage(response.data.message);
        } catch (error) {
            console.error(error);
            setMessage("Makale yükleme başarısız.");
        }
    };

    return (
        <div style={{ padding: "20px", maxWidth: "400px", margin: "auto" }}>
            <h2>Makale Yükle</h2>
            <form onSubmit={handleSubmit}>
                <label>
                    E-Posta:
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{ display: "block", width: "100%", padding: "8px", marginBottom: "10px" }}
                    />
                </label>

                <label>
                    PDF Dosyası:
                    <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileChange}
                        required
                        style={{ display: "block", marginBottom: "10px" }}
                    />
                </label>

                <button type="submit" style={{ padding: "10px", width: "100%" }}>Yükle</button>
            </form>

            {message && <p style={{ marginTop: "10px" }}>{message}</p>}
            {trackingNumber && <p><strong>Takip Numarası:</strong> {trackingNumber}</p>}
        </div>
    );
};

export default UploadArticle;
