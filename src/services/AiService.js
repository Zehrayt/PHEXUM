require('dotenv').config(); // .env dosyasındaki API şifremizi okur
const Groq = require("groq-sdk");

// Groq istemcisini başlatıyoruz
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Sisteme dahil ettiğimiz araçlarımızı (Tool) içeri alıyoruz
const createStudentTool = require('../tools/CreateStudentTool');

// LLM'in erişebileceği (Allowlist) araçlar havuzu
const availableTools = {
    [createStudentTool.name]: createStudentTool
};

class AiService {
    async processIntent(userInput, tenantContext) {
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
                model: "llama-3.3-70b-versatile", // Çok hızlı ve zeki bir model
                messages: [
                    { 
                        role: "system", 
                        content: "Sen JoedTech platformu için çalışan profesyonel bir eğitim asistanısın. Yanıtlarını SADECE Türkçe dilinde ver. Asla Çince, Japonca veya başka bir dilde karakter kullanma. Sadece istenen içeriği üret." 
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

// Servisi dışarıya hazır kullanımlık açıyoruz
module.exports = new AiService();