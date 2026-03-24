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

        // 1. Araçlarımızı LLM'in anlayacağı standart JSON şemasına (OpenAI Tools Format) çeviriyoruz
        const toolsFormat = Object.values(availableTools).map(tool => ({
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.schema
            }
        }));

        try {
            // 2. Groq (Llama 3) API'sine İsteği Atıyoruz
            const response = await groq.chat.completions.create({
                model: "llama-3.1-8b-instant", // Çok hızlı ve zeki bir model
                messages: [
                    { 
                        role: "system", 
                        content: systemInstruction // Yeni değişkenimizi buraya koyduk
                    },
                    { 
                        role: "user", 
                        content: userInput 
                    }
                ],
                tools: toolsFormat,
                tool_choice: "auto", // Kararı LLM'e bırakıyoruz
                temperature: 0.1 // Halüsinasyon ve uydurma riskini en aza indirmek için düşük sıcaklık
            });

            const responseMessage = response.choices[0].message;

            // Yanıtı ve soruyu hafızaya ekle (Hata almamak için sadece metin yanıtlarını kaydediyoruz)
            if (responseMessage.content) {
                this.memory.push({ role: 'user', content: userInput });
                this.memory.push({ role: 'assistant', content: responseMessage.content });

                // Hafıza çok şişip API limitlerini zorlamasın diye son 10 mesajı tutalım
                if (this.memory.length > 10) this.memory.shift();
            }

            // 3. PLAN DOĞRULAYICI (Plan Validator): LLM bir araç kullanmaya karar verdi mi?
            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                
                // LLM'in bize döndürdüğü JSON paketini ayrıştırıyoruz
                const toolCall = responseMessage.tool_calls[0];
                const toolName = toolCall.function.name;
                const params = JSON.parse(toolCall.function.arguments);

                console.log(`🎯 [NİYET ÇEVİRİSİ] LLM şu aracı seçti: ${toolName}`);
                console.log(`📦 [ÜRETİLEN JSON PARAMETRELERİ]`, params);

                const selectedTool = availableTools[toolName];
                
                if (selectedTool) {
                    // 4. RİSK MOTORU (Risk Engine) & İNSAN ONAYI (Human-in-the-Loop)
                    if (selectedTool.riskLevel === 'HIGH') {
                        console.log(`🛑 [RİSK MOTORU] Bu eylem YÜKSEK RİSKLİ. İnsan onayı bekleniyor!`);
                        return { status: "PENDING_APPROVAL", message: "Yüksek riskli işlem. Onay gerekiyor.", tool: toolName, params };
                    }
                    
                    // 5. KARARLI YÜRÜTME (Deterministic Execution)
                    console.log(`⚙️ [YÜRÜTME MOTORU] Onaylandı. Kararlı kod tetikleniyor...`);
                    const result = await selectedTool.execute(tenantContext, params);
                    return { status: "SUCCESS", data: result };
                }
            }

            // LLM eşleşen bir araç bulamazsa veya sadece sohbet etmek isterse:
            console.log(`🤷 [NO ACTION] LLM bu metne uygun bir sistem aracı bulamadı.`);
            return { status: "NO_ACTION", message: responseMessage.content || "Ne yapmak istediğinizi anlayamadım." };

        } catch (error) {
            console.error("🚨 [AI SERVİS HATASI]", error.message);
            return { status: "ERROR", message: error.message };
        }
    }
}

async function generateText(prompt) {
    const response = await groq.chat.completions.create({
        messages: [
            { role: "user", content: prompt }
        ],
        model: "llama-3.1-8b-instant"
    });

    return {
        message: response.choices[0].message.content
    };
}

module.exports = {
    processIntent,
    generateText
};

// Servisi dışarıya hazır kullanımlık açıyoruz
module.exports = new AiService();