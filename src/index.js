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

    const typeInstructions = {
        text: "Generate ONLY explanatory text. No questions.",
        image: "Generate an image prompt ONLY.",
        video: "Generate a video prompt ONLY.",

        "quiz-mcq": "Generate ONLY a multiple choice question with 4 options.",
        "quiz-fill": "Generate ONLY a fill-in-the-blank question.",
        "quiz-truefalse": "Generate ONLY a true/false question.",
        "quiz-short": "Generate ONLY a short answer question."
    };
        const instruction = typeInstructions[blockType] || "Generate appropriate content.";

    // PROFESYONEL GÖRSEL MOTORU: OPENAI DALL-E 3 ENTEGRASYONU (HAFIZA DESTEKLİ)

    if (blockType === 'image') {
        console.log(`[VİZYON MOTORU] Talimat alınıyor: "${prompt}"`);

        // 1. Llama 3'ten hafızayı kullanarak DALL-E için nihai promptu üretmesini istiyoruz
        const finalPrompt = `
        ${instruction}

        User request:
        ${prompt}

        STRICT RULE:
        Follow ONLY the instruction above.
        Do not generate other content types.
        `;
        try {
            // Llama 3 hafızayı okuyup bize mükemmel bir DALL-E promptu verecek
            const mockTenantContext = { userId: 101, role: "editor" };
            const aiResult = await AiService.processIntent(finalPrompt, mockTenantContext);
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
                return res.status(500).json({
                    status: "ERROR",
                    message: `OpenAI Hatası: ${data.error.message}`
                });
            }

            const imageUrl = data.data[0].url;

            const htmlContent = `
            <div style="text-align: center;">
                <img src="${imageUrl}" alt="${prompt}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #ddd;">
                <div style="font-size: 12px; margin-top: 10px; color: #666;">✨ DALL-E 3</div>
            </div>
            `;

            return res.json({
                status: "SUCCESS",
                content: htmlContent
            });
            
        } catch (error) {
            console.error("Görsel Üretim Hatası:", error);
            return res.status(500).json({ status: "ERROR", message: "Görsel üretilemedi." });
        }
    }

    if (blockType.startsWith('quiz')) {
        let questionInstruction = "";
        let htmlTemplate = ""; // YENİ: Soruya göre değişecek HTML tasarımı

        if(questionType === "quiz-mcq" || !questionType){ // Varsayılan veya Çoktan Seçmeli
            questionInstruction = "4 şıklı çoktan seçmeli soru hazırla.";
            htmlTemplate = `
            <ul style="list-style-type: none; padding: 0;">
                <li style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px; border: 1px solid #cbd5e0;"><input type="radio" name="q1"> A) [Şık]</li>
                <li style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px; border: 1px solid #cbd5e0;"><input type="radio" name="q1"> B) [Şık]</li>
                <li style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px; border: 1px solid #cbd5e0;"><input type="radio" name="q1"> C) [Şık]</li>
                <li style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px; border: 1px solid #cbd5e0;"><input type="radio" name="q1"> D) [Şık]</li>
            </ul>`;
        }
        else if(questionType === "quiz-fill"){
            questionInstruction = "Cümlenin ortasında bir boşluk (____) olan bir boşluk doldurma sorusu hazırla. Şık ekleme.";
            htmlTemplate = `
            <div style="margin-bottom: 15px;">
                <input type="text" placeholder="Cevabınızı buraya yazın..." style="width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #cbd5e0; outline: none;">
            </div>`;
        }
        else if(questionType === "quiz-truefalse"){
            questionInstruction = "Sadece 'Doğru' veya 'Yanlış' olarak cevaplanabilecek bir bilgi önermesi yaz.";
            htmlTemplate = `
            <ul style="list-style-type: none; padding: 0; display: flex; gap: 10px;">
                <li style="flex: 1; padding: 10px; background: white; border-radius: 4px; border: 1px solid #cbd5e0; text-align: center;"><input type="radio" name="q1"> Doğru</li>
                <li style="flex: 1; padding: 10px; background: white; border-radius: 4px; border: 1px solid #cbd5e0; text-align: center;"><input type="radio" name="q1"> Yanlış</li>
            </ul>`;
        }
        else if(questionType === "quiz-short"){
            questionInstruction = "1-2 kelimeyle veya tek bir cümleyle cevaplanabilecek, yoruma kapalı net bir kısa cevaplı soru hazırla.";
            htmlTemplate = `
            <div style="margin-bottom: 15px;">
                <textarea placeholder="Kısa cevabınızı buraya yazın..." style="width: 100%; height: 60px; padding: 10px; border-radius: 4px; border: 1px solid #cbd5e0; resize: none; outline: none;"></textarea>
            </div>`;
        }

        console.log(`[EĞİTİM MOTORU] Hazırlanıyor: Tür=[${questionType}] Konu="${prompt}"`);

        const quizPrompt = `
        Konu / Kullanıcı Talimatı: ${prompt}
        Soru tipi: ${questionInstruction}
        
        EĞER BU BİR DÜZELTME İSTEĞİYSE ŞU KURALLARA KESİNLİKLE UY:
        1. Önceki konuşma geçmişimizdeki sorunun metnini, açıklamasını ve DOĞRU CEVABINI ASLA değiştirme.
        2. Eğer benden yanlış bir şıkkı (çeldiriciyi) değiştirmem isteniyorsa, yerine yazacağım yeni şık da KESİNLİKLE YANLIŞ BİLGİ içermelidir! Doğru cevabı başka bir şıkka kaydırma.
        3. Sadece benden istenen kısmı değiştir, geri kalan her şeyi birebir aynı bırak.
        
        EĞER YENİ BİR SORU İSTENİYORSA: Belirtilen soru tipine uygun, kaliteli 1 adet soru hazırla.
        PEDAGOJİK KURAL: Eğer şıklı bir soru üretiyorsan, şıkların zorluk seviyeleri birbirine ÇOK YAKIN olmalıdır. Absürt, komik veya bariz yanlış olan zayıf çeldiriciler KULLANMA. Çeldiriciler konuya ait bilimsel olarak mantıklı yanılgılardan oluşmalıdır.

        MUTLAK KURAL (SIFIR TOLERANS): Çıktın SADECE VE SADECE aşağıdaki HTML kodundan oluşmalıdır!
        "İşte hazırladığım soru", "Tabii ki" gibi HİÇBİR sohbet veya giriş cümlesi KESİNLİKLE YAZMA. 
        Doğrudan <div ile başla ve </div> ile bitir. Markdown (\`\`\`) işaretleri KULLANMA!
        
        <div style="border: 2px solid #3182ce; padding: 15px; border-radius: 8px; background: #ebf8ff; margin-bottom: 10px;">
            <h4 style="margin-bottom: 10px; color: #2b6cb0;">❓ Bilgi Testi</h4>
            <p style="margin-bottom: 15px; font-weight: 500;"><strong>Soru:</strong> [Soruyu buraya yaz]</p>
            
            ${htmlTemplate}
            
            <details style="margin-top: 15px; cursor: pointer; color: #2f855a; background: #c6f6d5; padding: 10px; border-radius: 6px;">
                <summary style="font-weight: bold;">Cevabı Göster</summary>
                <p style="margin-top: 10px; font-size: 14px;"><strong>Doğru Cevap:</strong> [Doğru Cevap] <br><br> <strong>Açıklama:</strong> [Kısa bir açıklama yap]</p>
            </details>
        </div>`;

        try {
            // İsteği AiService üzerinden gönderiyoruz
            const mockTenantContext = { userId: 101, role: "editor", branch_id: 5 };
            const result = await AiService.processIntent(quizPrompt, mockTenantContext);
            
            return res.json({
                status: "SUCCESS",
                type: "html", //  KRİTİK
                content: result.message,
                error: null
            });
                    } catch (error) {
            console.error("Soru Üretim Hatası:", error);
            return res.status(500).json({
                status: "ERROR",
                type: null,
                content: null,
                error: "Soru üretilemedi."
            });
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

            console.log("VIDEO HTML:", htmlContent);

            return res.json({
                status: "SUCCESS",
                content: htmlContent
            });

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

    const finalPrompt = `
    ${instruction}

    User request:
    ${prompt}

    STRICT RULE:
    Follow ONLY the instruction above.
    Do not generate other content types.
    `;

    try {
        const result = await AiService.processIntent(finalPrompt, mockTenantContext);

        console.log("BLOCK TYPE:", blockType);
        console.log("AI RAW:", result.message);

        // KRİTİK DÜZELTME: AiService hata döndürdüyse bunu Frontend'e HATA olarak bildir
        if (result.status === "ERROR") {
            return res.status(500).json({
                status: "ERROR",
                message: result.message
            });
        }

        let cleanContent = result.message;

        if (blockType === "text") {
            cleanContent = cleanContent.replace(/<[^>]*>/g, '');
        } else if (blockType.startsWith("quiz")) {
            if (!cleanContent.includes("<")) {
                cleanContent = `<div>${cleanContent}</div>`;
            }
        }

        if (!cleanContent || cleanContent.trim() === "") {
            cleanContent = "İçerik üretilemedi.";
        }

        return res.json({
            status: "SUCCESS",
            type: blockType,
            content: cleanContent
        });

    } catch (error) {
        console.error("🚨 [AI SERVİS HATASI]", error);
        return res.status(500).json({
            status: "ERROR",
            message: "Yapay zeka sunucusuna bağlanırken bir hata oluştu."
        });
    }
});

app.post('/api/page-plan', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "Prompt gerekli" });
    }

    try {
        console.log(`\n [PAGE ORCHESTRATOR] Sayfa Mimarisi Çiziliyor...`);
        console.log(`Talebiniz: "${prompt}"`);

        // 1. MUAZZAM SIFIR TOLERANS PROMPTUMUZ
        const orchestratorPrompt = `
        GÖREV: Konuya uygun E-Kitap sayfa mizanpajı (layout) JSON'ı oluştur.
        KONU: ${prompt}

        PEDAGOJİK SORU SEÇİMİ (Konuya en uygun 1-2 tanesini seç):
        - "quiz-mcq": Detaylı bilgi ölçümü
        - "quiz-fill": Terim/kavram ezberi
        - "quiz-truefalse": Kesin ve net yargılar
        - "quiz-short": Kavramsal anlama

        KURAL: SADECE GEÇERLİ JSON DÖNDÜR. Asla açıklama veya \`\`\` kullanma. Görselleri metinlerin yanına (aynı row içine) koy.

        JSON ŞABLONU:
        {
          "layout": [
            {
              "type": "row",
              "children": [
                { "type": "text", "prompt": "Detaylı konu anlatımı" },
                { "type": "image", "prompt": "Detaylı İNGİLİZCE görsel betimlemesi" }
              ]
            },
            {
              "type": "row",
              "children": [
                { "type": "quiz-mcq", "prompt": "Zorlayıcı test sorusu" }
              ]
            }
          ]
        }
        `;

        // Llama 3'ten mimariyi istiyoruz
        const aiResult = await AiService.generateText(orchestratorPrompt);

        // 2. GÜÇLÜ JSON AYIKLAYICI (Regex)
        // AI gevezelik yapıp sonuna "Umarım beğenirsiniz" yazsa bile, sadece { } arasını çeker alır!
        const match = aiResult.message.match(/\{[\s\S]*\}/);
        
        if (!match) {
            throw new Error("Yapay zeka geçerli bir JSON haritası çizemedi.");
        }

        const cleanJson = match[0];
        const json = JSON.parse(cleanJson);

        // 🔥 1️⃣ duplicate temizleme
        const usedTypes = new Set();

        if (json.layout && Array.isArray(json.layout)) {
        json.layout.forEach(row => {

            if (!row.children || !Array.isArray(row.children)) return;

            row.children = row.children.filter(block => {

            if (!block.type) return false;

            const typeKey = block.type;

            if (usedTypes.has(typeKey)) {
                return false;
            }

            usedTypes.add(typeKey);
            return true;
            });

        });
        }

        // 🔥 2️⃣ max block limiti
        let totalBlocks = 0;

        if (json.layout && Array.isArray(json.layout)) {
        json.layout.forEach(row => {

            if (!row.children || !Array.isArray(row.children)) return;

            row.children = row.children.filter(block => {

            if (totalBlocks >= 6) return false;

            totalBlocks++;
            return true;
            });

        });
        }

        console.log("✅ JSON Haritası Başarıyla Çıkarıldı! Arayüze gönderiliyor...");
        res.json(json);

    } catch (error) {
        console.error("🚨 [MİMAR HATASI]:", error.message);
        res.status(500).json({ error: "Plan oluşturulamadı: " + error.message });
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
                "suggestedPrompt": "Konuya uygun yeni bir prompt önerisi"
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
