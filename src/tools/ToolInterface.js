/**
 * JOEDTECH AI PLATFORM - TEMEL ARAÇ SOYUTLAMASI
 * Gelecekte eklenecek tüm modüller (CRM, HR, Sınıf) bu şablonu kullanmak zorundadır.
 */
class ToolInterface {
    /**
     * @param {string} name - Aracın sistemdeki eşsiz adı (Örn: "create_student")
     * @param {string} description - LLM'in bu aracın ne işe yaradığını anlaması için açıklama
     * @param {string} riskLevel - Güvenlik seviyesi: "LOW", "MEDIUM", "HIGH"
     * @param {object} schema - LLM'in uyması gereken zorunlu JSON şeması (Parametreler)
     */
    constructor(name, description, riskLevel, schema) {
        this.name = name;
        this.description = description;
        this.riskLevel = riskLevel;
        this.schema = schema;
    }

    /**
     * Kararlı Yürütme Motoru (Deterministic Execution)
     * AI bu fonksiyonu doğrudan çağıramaz. Backend çağırır.
     * @param {object} tenantContext - JWT'den gelen güvenli kullanıcı bilgileri
     * @param {object} params - AI'ın ürettiği güvensiz JSON parametreleri
     */
    async execute(tenantContext, params) {
        throw new Error(`[MİMARİ HATASI] ${this.name} aracı için execute metodu yazılmamış!`);
    }
}

module.exports = ToolInterface;