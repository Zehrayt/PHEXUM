const ToolInterface = require('./ToolInterface');

class CreateStudentTool extends ToolInterface {
    constructor() {
        super(
            "create_student", // Aracın Adı
            "Sisteme yeni bir öğrenci kaydeder. Öğrencinin adı ve atanacağı şube ID'si zorunludur.", // LLM için açıklama
            "MEDIUM", // Risk Seviyesi: Otomatik çalışabilir ama loglanması gerekir
            {
                type: "object",
                properties: {
                    full_name: { type: "string", description: "Öğrencinin tam adı" },
                    branch_id: { type: "number", description: "Öğrencinin ekleneceği şubenin ID'si" }
                },
                required: ["full_name", "branch_id"]
            }
        );
    }

    /**
     * @param {object} tenantContext - Sistemden gelen GÜVENLİ veri (Örn: JWT Token içeriği)
     * @param {object} params - AI'ın ürettiği GÜVENSİZ veri (JSON JSON)
     */
    async execute(tenantContext, params) {
        // 1. GÜVENLİK KALKANI (IDOR KORUMASI)
        // AI'ın ürettiği şube ID'si ile kullanıcının gerçek şube ID'si uyuşuyor mu?
        if (tenantContext.branch_id !== params.branch_id) {
            console.error(`\n🚨 [GÜVENLİK İHLALİ DETECTED]`);
            console.error(`Kullanıcının Şubesi: ${tenantContext.branch_id} | AI'ın İşlem Yapmak İstediği Şube: ${params.branch_id}`);
            throw new Error(`Yetki hatası: Sadece kendi şubenize (${tenantContext.branch_id}) öğrenci ekleyebilirsiniz.`);
        }

        // 2. İŞ MANTIĞI VE VERİTABANI (MOCK)
        // Burada normalde PostgreSQL/MongoDB'ye kayıt atılır. Biz şimdilik terminale yazdırıyoruz.
        console.log(`\n✅ [DB İŞLEMİ] "${params.full_name}" isimli öğrenci, ${params.branch_id} numaralı şubeye başarıyla eklendi.`);
        
        return { 
            success: true, 
            message: "Öğrenci kaydı başarıyla tamamlandı.",
            data: { student: params.full_name, branch: params.branch_id }
        };
    }
}

// Sınıfı dışarıya hazır bir obje (instance) olarak aktarıyoruz
module.exports = new CreateStudentTool();