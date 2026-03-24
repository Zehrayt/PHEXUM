require('dotenv').config(); // .env dosyasındaki API şifremizi okur
const Groq = require("groq-sdk");

// Groq istemcisini başlatıyoruz
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// LLM'in erişebileceği (Allowlist) araçlar havuzu
const availableTools = {};

class AiService {
    constructor() {
        // Mesaj geçmişini bu dizide tutacağız
        this.memory = [];
    }

    // ====================================================================
    // 1. MİKRO AJAN MOTORU (Blok içi düzenlemeler ve araç seçimi için)
    // ====================================================================
    async processIntent(userInput, tenantContext) {

        // 1. Önceki konuşmaları belleğe göre string'e dönüştür
        const historyString = this.memory
            .map(m => `${m.role === 'user' ? 'Kullanıcı' : 'Asistan'}: ${m.content}`)
            .join('\n');

        // 2. Dinamik Sistem Talimatı (Hafızayı buraya gömüyoruz)
        const systemInstruction = `Sen JoedTech platformu için çalışan profesyonel bir eğitim asistanısın. 
        Yanıtlarını SADECE Türkçe dilinde ver. Kullanıcının önceki mesajlarını dikkate almalısın.
        Eğer kullanıcı mevcut bir içerikte değişiklik istiyorsa, önceki içeriği hatırla ve sadece istenen kısmı güncelle.

        Önceki Konuşmalar:
        ${historyString || "Henüz konuşma geçmişi yok."}`;

        console.log(`\n🧠 [AI ORCHESTRATOR] Kullanıcı komutu LLM'e iletiliyor: "${userInput}"`);

        // Araçlarımızı LLM'in anlayacağı standart JSON şemasına çeviriyoruz
        const toolsFormat = Object.values(availableTools).map(tool => ({
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.schema
            }
        }));

        try {
            // Groq (Llama 3) API'sine İsteği Atıyoruz
            const response = await groq.chat.completions.create({
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: userInput }
                ],
                // Sadece sisteme kayıtlı araç varsa "tools" gönder, yoksa LLM'in kafasını karıştırma
                ...(toolsFormat.length > 0 && { tools: toolsFormat, tool_choice: "auto" }),
                temperature: 0.1 
            });

            const responseMessage = response.choices[0].message;

            // Yanıtı ve soruyu hafızaya ekle
            if (responseMessage.content) {
                this.memory.push({ role: 'user', content: userInput });
                this.memory.push({ role: 'assistant', content: responseMessage.content });

                // 🔥 TOKEN LİMİT KORUMASI: Hafızayı sadece son 4 mesaj (2 soru-cevap) ile sınırla
                if (this.memory.length > 4) this.memory.shift();
            }

            // PLAN DOĞRULAYICI: LLM bir araç kullanmaya karar verdi mi?
            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                const toolCall = responseMessage.tool_calls[0];
                const toolName = toolCall.function.name;
                const params = JSON.parse(toolCall.function.arguments);

                console.log(`🎯 [NİYET ÇEVİRİSİ] LLM şu aracı seçti: ${toolName}`);

                const selectedTool = availableTools[toolName];
                if (selectedTool) {
                    if (selectedTool.riskLevel === 'HIGH') {
                        return { status: "PENDING_APPROVAL", message: "Yüksek riskli işlem onay bekliyor.", tool: toolName, params };
                    }
                    const result = await selectedTool.execute(tenantContext, params);
                    return { status: "SUCCESS", data: result };
                }
            }

            // LLM araç bulamazsa
            console.log(`🤷 [NO ACTION] LLM bir araç seçmedi, metin döndürdü.`);
            return { status: "NO_ACTION", message: responseMessage.content || "Ne yapmak istediğinizi anlayamadım." };

        } catch (error) {
            console.error("🚨 [AI SERVİS HATASI]", error.message);
            return { status: "ERROR", message: error.message };
        }
    }

    // ====================================================================
    // 2. MAKRO MİMAR MOTORU (Tüm sayfanın JSON krokisini çizmek için eklendi)
    // ====================================================================
    async generateText(prompt) {
        console.log(`\n🏗️ [PAGE ORCHESTRATOR] JSON Mimarisi Çiziliyor...`);
        
        try {
            const response = await groq.chat.completions.create({
                messages: [
                    { role: "user", content: prompt }
                ],
                model: "llama-3.1-8b-instant",
                temperature: 0.1 // Tasarım yapacağı için yaratıcılığı tamamen kısıyoruz (net JSON versin)
            });

            return {
                message: response.choices[0].message.content
            };
        } catch (error) {
            console.error("🚨 [MİMAR HATASI]", error.message);
            throw error; // Hatayı index.js'e fırlat ki arayüzde görebilelim
        }
    }
}

// Servisi dışarıya TEK BİR OBJE (Singleton) olarak hazır kullanımlık açıyoruz!
module.exports = new AiService();