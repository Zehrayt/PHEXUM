require("dotenv").config();

const express = require('express');
const path = require('path');
const AiService = require('./services/AiService');
const Replicate = require('replicate');

async function searchSources(text) {

    const sentences = text
        .split(/[.!?]/)
        .map(s => s.trim())
        .filter(s => s.length > 30);

    for (const sentence of sentences) {

        const query = encodeURIComponent(`"${sentence}"`);

        const url = `https://www.googleapis.com/customsearch/v1?q=${query}&key=${process.env.GOOGLE_API_KEY}&cx=${process.env.SEARCH_ENGINE_ID}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.items && data.items.length > 0) {

            return data.items.slice(0,3).map(item => ({
                title: item.title,
                link: item.link
            }));

        }
    }

    return [];
}

const app = express();
const PORT = 3000;

// Replicate motorunu API şifremizle başlatıyoruz
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Gelen JSON verilerini okuyabilmek için
app.use(express.json());

// Frontend (Arayüz) dosyalarımızı dışa açıyoruz
app.use(express.static(path.join(__dirname, '../public')));

// API KÖPRÜSÜ: Frontend'in Yapay Zekaya İstek Attığı Kapı
app.post('/api/generate', async (req, res) => {
    // Frontend'den (app.js) gönderilen verileri alıyoruz
    const { prompt, blockType, questionType } = req.body;
    
    console.log(`\n[API] Frontend'den talep geldi: [Blok: ${blockType}] - "${prompt}"`);

    // GÜVENLİK KONTROLÜ: Eğer prompt boşsa, LLM'e sormadan hata döndürelim
    if (!prompt) {
        return res.status(400).json({ status: "ERROR", message: "Yapay zeka için bir istek (prompt) yazmalısınız." });
    }

    
    // PROFESYONEL GÖRSEL MOTORU: OPENAI DALL-E 3 ENTEGRASYONU (HAFIZA DESTEKLİ)

    if (blockType === 'image') {
        console.log(`[VİZYON MOTORU] Talimat alınıyor: "${prompt}"`);

        // 1. Llama 3'ten hafızayı kullanarak DALL-E için nihai promptu üretmesini istiyoruz
        const imagePromptRequest = `Kullanıcı bir görsel üretmek veya mevcut görselini değiştirmek istiyor.
        Kullanıcının Talimatı: "${prompt}"
        Eğer bu bir düzeltme/güncelleme isteğiyse (örneğin "bunu gece yap", "arabayı kırmızı yap"), önceki konuşma geçmişindeki görsel detaylarını hatırla ve görselin tamamını anlatan YENİ ve TEK BİR İNGİLİZCE PROMPT üret.
        Eğer yeni bir istekse, doğrudan İngilizce, detaylı ve DALL-E 3'e uygun fütüristik/sinematik bir prompt yaz.
        ÇIKTI KURALI: SADECE İNGİLİZCE PROMPTU YAZ, BAŞKA HİÇBİR AÇIKLAMA, GİRİŞ VEYA TIRNAK İŞARETİ KULLANMA.`;

        try {
            // Llama 3 hafızayı okuyup bize mükemmel bir DALL-E promptu verecek
            const mockTenantContext = { userId: 101, role: "editor" };
            const aiResult = await AiService.processIntent(imagePromptRequest, mockTenantContext);
            const finalImagePrompt = aiResult.message;
            
            console.log(`[VİZYON MOTORU] DALL-E'ye Giden Akıllı Prompt: "${finalImagePrompt}"`);

            // 2. OpenAI API'sine bu zenginleştirilmiş prompt ile bağlanıyoruz
            const response = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "dall-e-3",
                    prompt: finalImagePrompt, // Zenginleştirilmiş promptu kullanıyoruz
                    n: 1,
                    size: "1024x1024"
                })
            });

            const data = await response.json();

            if (data.error) {
                 return res.json({ status: "NO_ACTION", message: `<div style="color: #e53e3e; padding: 10px; border: 1px solid #fc8181; border-radius: 8px; background: #fff5f5;">🚨 OpenAI Hatası: ${data.error.message}</div>` });
            }

            const imageUrl = data.data[0].url;
            
            const htmlContent = `<div style="text-align: center;">
                <img src="${imageUrl}" alt="${prompt}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #ddd;">
                <div style="font-size: 12px; margin-top: 10px; color: #666;">✨ DALL-E 3 (Hafıza Destekli)</div>
            </div>`;

            return res.json({ status: "NO_ACTION", message: htmlContent });

        } catch (error) {
            console.error("Görsel Üretim Hatası:", error);
            return res.status(500).json({ status: "ERROR", message: "Görsel üretilemedi." });
        }
    }

    if (blockType === 'quiz') {

                let questionInstruction = "";

        if(questionType === "quiz-mcq"){
            questionInstruction = "4 şıklı çoktan seçmeli soru hazırla.";
        }

        if(questionType === "quiz-fill"){
            questionInstruction = "boşluk doldurma sorusu hazırla, çoktan seçmeli soru hazırlama.";
        }

        if(questionType === "quiz-truefalse"){
            questionInstruction = "doğru yanlış sorusu hazırla,çoktan seçmeli soru hazırlama.";
        }

        if(questionType === "quiz-short"){
            questionInstruction = "kısa cevaplı bir soru hazırla,çoktan seçmeli soru hazırlama.";
}

        console.log(`[EĞİTİM MOTORU] Soru seti hazırlanıyor/güncelleniyor: "${prompt}"`);
        
        const quizPrompt = `
        Konu: ${prompt}

        Soru tipi: ${questionInstruction}
        
        Eğer bu bir DÜZELTME/GÜNCELLEME isteğiyse, önceki konuşma geçmişimizdeki soru setini temel al ve SADECE benden istenen değişikliği yap.
        Eğer YENİ BİR SORU SETİ istiyorsam, belirtilen soru tipine uygun 1 adet soru hazırla.
        
        ÖNEMLİ KURAL: Çıktıyı SADECE aşağıdaki HTML formatında ver, kod bloğu (\`\`\`) içine alma ve ekstra hiçbir açıklama yazma. Yapıyı asla bozma:
        
        <div style="border: 2px solid #3182ce; padding: 15px; border-radius: 8px; background: #ebf8ff; margin-bottom: 10px;">
            <h4 style="margin-bottom: 10px; color: #2b6cb0;">❓ Bilgi Testi</h4>
            <p style="margin-bottom: 15px; font-weight: 500;"><strong>Soru:</strong> [Soruyu buraya yaz]</p>
            <ul style="list-style-type: none; padding: 0;">
                <li style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px; border: 1px solid #cbd5e0;"><input type="radio" name="q1"> A) [Şık]</li>
                <li style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px; border: 1px solid #cbd5e0;"><input type="radio" name="q1"> B) [Şık]</li>
                <li style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px; border: 1px solid #cbd5e0;"><input type="radio" name="q1"> C) [Şık]</li>
                <li style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px; border: 1px solid #cbd5e0;"><input type="radio" name="q1"> D) [Şık]</li>
            </ul>
            <details style="margin-top: 15px; cursor: pointer; color: #2f855a; background: #c6f6d5; padding: 10px; border-radius: 6px;">
                <summary style="font-weight: bold;">Cevabı Göster</summary>
                <p style="margin-top: 10px; font-size: 14px;"><strong>Doğru Cevap:</strong> [Doğru Şık] <br><br> <strong>Açıklama:</strong> [Kısa bir açıklama yap]</p>
            </details>
        </div>`;

        try {
            // İsteği AiService üzerinden gönderiyoruz, o arka planda hafızayı (Memory) da ekleyecek
            const mockTenantContext = { userId: 101, role: "editor", branch_id: 5 };
            const result = await AiService.processIntent(quizPrompt, mockTenantContext);
            
            return res.json({
                status: "NO_ACTION", 
                message: result.message // Yapay zekanın ürettiği HTML'i doğrudan arayüze yolluyoruz
            });
        } catch (error) {
            console.error("Soru Üretim Hatası:", error);
            return res.status(500).json({ status: "ERROR", message: "Soru üretilemedi." });
        }
    }

    // GERÇEK VİDEO MOTORU: REPLICATE AI ENTEGRASYONU (HAFIZA DESTEKLİ)
    if (blockType === 'video') {
        console.log(`\n[VİDEO MOTORU] Talimat alınıyor: "${prompt}"`);

        // 1. Llama 3'ten hafızayı kullanarak Replicate için senaryo üretmesini istiyoruz
        const videoPromptRequest = `Kullanıcı bir AI videosu üretmek veya mevcut videoyu değiştirmek istiyor.
        Kullanıcının Talimatı: "${prompt}"
        Eğer bu bir düzeltme/güncelleme isteğiyse (örneğin "buna kar yağdır", "kamerayı yakınlaştır"), önceki konuşma geçmişindeki senaryoyu hatırla ve videonun tamamını anlatan YENİ ve TEK BİR İNGİLİZCE SENARYO üret.
        Eğer yeni bir istekse, doğrudan İngilizce ve detaylı bir video promptu yaz.
        ÇIKTI KURALI: SADECE İNGİLİZCE PROMPTU YAZ, BAŞKA HİÇBİR AÇIKLAMA, GİRİŞ VEYA TIRNAK İŞARETİ KULLANMA.`;

        try {
            // Llama 3 senaryoyu zenginleştiriyor
            const mockTenantContext = { userId: 101, role: "editor" };
            const aiResult = await AiService.processIntent(videoPromptRequest, mockTenantContext);
            const finalVideoPrompt = aiResult.message;
            
            console.log(`[VİDEO MOTORU] Replicate'e Giden Akıllı Senaryo: "${finalVideoPrompt}"`);
            console.log(`[VİDEO MOTORU] Lütfen bekleyin, video çiziliyor...`);

            // 2. Replicate'e zenginleştirilmiş promptu gönderiyoruz
            const output = await replicate.run(
                  "anotherjesse/zeroscope-v2-xl:7a8c0a6a3a94d7a7d6e8d6f6b7c4e8f0f3bfe4b9e3f0c1f1c0a8e2a6d9b8c7a6",
                {
                    input: {
                    prompt: finalVideoPrompt,
                    num_frames: 16,
                    fps: 8,
                    width: 512,
                    height: 512
                    }
                }
                );

            console.log("VIDEO OUTPUT:", output); 
            console.log("REPLICATE TOKEN:", process.env.REPLICATE_API_TOKEN);   

            const videoUrl = Array.isArray(output) ? output[0] : output;            
            
            const htmlContent = `
            <div style="border: 1px solid #38a169; border-radius: 8px; overflow: hidden; background: #1a202c; text-align: center; margin-bottom: 15px;">
                <div style="background: #276749; color: white; padding: 10px 15px; font-size: 13px; text-align: left;">
                    🎬 <b>Akıllı Senaryo:</b> ${finalVideoPrompt}
                </div>
                <video width="100%" height="auto" controls autoplay loop style="max-height: 400px; outline: none; background: #000;">
                    <source src="${videoUrl}" type="video/mp4">
                    Tarayıcınız video etiketini desteklemiyor.
                </video>
            </div>`;

            return res.json({ status: "NO_ACTION", message: htmlContent });

        } catch (error) {
            console.error("🚨 [VİDEO HATASI]:", error);
            return res.status(500).json({ status: "ERROR", message: "Video üretilemedi." });
        }
    }

    
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

// SÜPERVİZÖR BEYNİ: İÇERİK BÜTÜNLÜĞÜ ANALİZİ
app.post('/api/analyze', async (req, res) => {
    const { pageContent } = req.body;
    console.log(`\n[SÜPERVİZÖR] Sayfa bütünlüğü kontrol ediliyor...`);

    const analysisPrompt = `
    Sen profesyonel bir "Eğitim İçeriği Süpervizörü"sün.
    Kullanıcı yapay zeka araçlarını kullanarak bir e-kitap sayfası hazırladı.
    
    Sayfa İçeriği:
    ${pageContent}
    
    GÖREVİN:
    Bu içeriklerin bağlamsal uyumunu analiz et ve SADECE aşağıdaki JSON formatında yanıt ver. Başka hiçbir kelime, giriş veya açıklama yazma. Sadece geçerli bir JSON döndür.
    
    {
        "score": "7/10",
        "general_summary": "Sayfanın genel uyumu hakkında 1-2 cümlelik kısa özet.",
        "improvements": [
            {
                "blockNumber": 2,
                "reason": "Bu soru seti, üstteki metnin bağlamından kopuk.",
                "suggestedPrompt": "Hücre bölünmesi evreleri hakkında zorlayıcı bir soru hazırla"
            }
        ]
    }
    
    Eğer düzeltilecek bir blok yoksa "improvements" dizisini boş bırak.
    `;

    try {
        // Doğrudan Llama 3'e (AiService'e) gönderip analiz istiyoruz
        const mockTenantContext = { userId: 101, role: "editor" };
        const result = await AiService.processIntent(analysisPrompt, mockTenantContext);
        
        res.json({ status: "SUCCESS", message: result.message });
    } catch (error) {
        console.error("Analiz Hatası:", error);
        res.status(500).json({ status: "ERROR", message: "Bütünlük analizi yapılamadı." });
    }
});

// GÜVENLİK MOTORU: TELİF VE İNTİHAL KONTROLÜ
app.post('/api/check-copyright', async (req, res) => {

    const { textContent } = req.body;

    console.log("[PLAGIARISM CHECK] Searching sources...");

    try {

        const sources = await searchSources(textContent);

        if (sources.length > 0) {

            const html = `
            <div style="padding:10px;border:2px solid #e53e3e;background:#fff5f5;border-radius:8px;">
                <h4 style="color:#c53030;margin-bottom:8px;">🚨 Possible plagiarism detected</h4>
                <p>Possible sources:</p>
                <ul>
                    ${sources.map(s => `<li><a href="${s.link}" target="_blank">${s.title}</a></li>`).join("")}
                </ul>
            </div>
            `;

            return res.json({
                status:"PLAGIARIZED",
                message: html
            });

        }

        return res.json({
            status:"CLEAN",
            message:"✅ No similar sources found"
        });

    } catch(error) {

        console.error("Search error:", error);

        return res.status(500).json({
            status:"ERROR",
            message:"Search failed"
        });

    }

});

app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 JOEDTECH AI PLATFORM ÇALIŞIYOR!`);
    console.log(`🌐 Lütfen tarayıcınızda şu adresi açın: http://localhost:${PORT}`);
    console.log(`==================================================`);
});