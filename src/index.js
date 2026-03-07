const express = require('express');
const path = require('path');
const AiService = require('./services/AiService');

const app = express();
const PORT = 3000;

// Gelen JSON verilerini okuyabilmek için
app.use(express.json());

// Frontend (Arayüz) dosyalarımızı dışa açıyoruz
app.use(express.static(path.join(__dirname, '../public')));

// API KÖPRÜSÜ: Frontend'in Yapay Zekaya İstek Attığı Kapı
// API KÖPRÜSÜ: Frontend'in Yapay Zekaya İstek Attığı Kapı
// API KÖPRÜSÜ: Frontend'den gelen istekleri karşılayan ana kapı
app.post('/api/generate', async (req, res) => {
    // Frontend'den (app.js) gönderilen verileri alıyoruz
    const { prompt, blockType } = req.body;
    
    console.log(`\n[API] Frontend'den talep geldi: [Blok: ${blockType}] - "${prompt}"`);

    // GÜVENLİK KONTROLÜ: Eğer prompt boşsa, LLM'e sormadan hata döndürelim
    if (!prompt) {
        return res.status(400).json({ status: "ERROR", message: "Yapay zeka için bir istek (prompt) yazmalısınız." });
    }

    // ---------------------------------------------------------
    // 🎨 [DÜZELTME] GÖRSEL OLUŞTURMA YÖNLENDİRMESİ
    // Arayüzden gelen bloğun tipi "image" ise bu blok çalışır
    // ---------------------------------------------------------
    // "blockType" tam olarak "image" ise görsel API'sine yönlendir
    // ---------------------------------------------------------
    // 🎨 GÖRSEL OLUŞTURMA YÖNLENDİRMESİ
    // ---------------------------------------------------------
    // ---------------------------------------------------------
    // 🎨 PROFESYONEL GÖRSEL MOTORU: OPENAI DALL-E 3 ENTEGRASYONU
    // ---------------------------------------------------------
    if (blockType === 'image') {
        console.log(`[VİZYON MOTORU] DALL-E'ye resim çizdiriliyor: "${prompt}"`);

        try {
            // OpenAI API'sine doğrudan bağlantı kuruyoruz (Ekstra kütüphaneye gerek yok!)
            const response = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` // .env'den şifreyi okur
                },
                body: JSON.stringify({
                    model: "dall-e-3", // Dünyanın en iyi resim modellerinden biri
                    prompt: prompt,
                    n: 1, // 1 adet resim istiyoruz
                    size: "1024x1024" // DALL-E 3 standart boyutu
                })
            });

            const data = await response.json();

            // Eğer OpenAI tarafında bir hata olursa (Örn: bakiye yetersiz, kural ihlali)
            if (data.error) {
                 console.error("[DALL-E HATASI]:", data.error.message);
                 return res.json({
                    status: "NO_ACTION",
                    message: `<div style="color: #e53e3e; padding: 10px; border: 1px solid #fc8181; border-radius: 8px; background: #fff5f5;">🚨 <b>OpenAI Hatası:</b> ${data.error.message}</div>`
                 });
            }

            // DALL-E resmi başarıyla çizdi, URL'sini alıyoruz
            const imageUrl = data.data[0].url;
            console.log(`[VİZYON MOTORU] DALL-E Çizimi Tamamladı!`);

            // Resmi şık bir çerçeveyle arayüze gönderiyoruz
            const htmlContent = `<div style="text-align: center;">
                <img src="${imageUrl}" alt="${prompt}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #ddd;">
                <div style="font-size: 12px; margin-top: 10px; color: #666;">✨ OpenAI DALL-E 3 Tarafından Üretildi</div>
            </div>`;

            return res.json({
                status: "NO_ACTION", 
                message: htmlContent
            });

        } catch (error) {
            console.error("OpenAI Bağlantı Hatası:", error);
            return res.status(500).json({ status: "ERROR", message: "Görsel üretilirken sunucuya ulaşılamadı." });
        }
    }

    // ---------------------------------------------------------
    // 📝 DİĞER BLOKLAR (Metin, Video, Soru vb.) LLM'e Gider
    // ---------------------------------------------------------
    
    // Güvenlik: Sanki sisteme giriş yapmış bir kullanıcı var gibi davranıyoruz
    const mockTenantContext = {
        userId: 101,
        role: "editor", // Yetki seviyesi
        branch_id: 5 // Sadece 5 numaralı şubeye işlem yapabilir
    };

    try {
        // İstemi bizim yazdığımız AI Orkestratörüne (Beyne) gönderiyoruz
        // Bu motor, isteği analiz edip Groq'a gönderir ve cevabı (JSON) bize döndürür
        const result = await AiService.processIntent(prompt, mockTenantContext);
        
        // AI'dan dönen sonucu (JSON) tekrar arayüze yolluyoruz
        res.json(result);
    } catch (error) {
        console.error(`🚨 [AI SERVİS HATASI]`, error);
        res.status(500).json({ status: "ERROR", message: "Yapay zeka sunucusuna bağlanırken bir hata oluştu." });
    }
});

app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 JOEDTECH AI PLATFORM ÇALIŞIYOR!`);
    console.log(`🌐 Lütfen tarayıcınızda şu adresi açın: http://localhost:${PORT}`);
    console.log(`==================================================`);
});