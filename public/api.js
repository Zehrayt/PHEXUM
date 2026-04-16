export async function generateBlockContent(prompt, blockType, questionType) {
    try {
        const res = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, blockType, questionType })
        });
        return await res.json();
    } catch (err) {
        console.error("API Hatası:", err);
        return { status: "ERROR", message: "Bağlantı hatası" };
    }
}

// Tüm sayfa mimarisini üretme
export async function generatePagePlan(prompt) {
    try {
        const res = await fetch("/api/page-plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: prompt + " Bu konu için öğretici ve düzenli bir sayfa oluştur." })
        });
        
        const data = await res.json();
        
        // KRİTİK DÜZELTME: Sunucu hatası veya backend'den gelen error varsa catch bloğuna at!
        if (!res.ok || data.error) {
            throw new Error(data.error || "Plan oluşturulamadı");
        }
        
        return data;
    } catch (err) {
        console.error("Plan Hatası:", err);
        throw err;
    }
}