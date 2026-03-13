Mimari Karar Kaydı (ADR): Sayfa Orkestratörü (Page Orchestrator)
Tarih: Mart 2026
Modül: AI Sayfa Orkestratörü ve Dinamik Mizanpaj (Layout) Motoru
Durum: Tasarım Onaylandı, Geliştirmeye Başlanacak

1. Projenin Mevcut Durumu ve Yeni Vizyon (Bağlam)
Mevcut Durum: JoedTech AI E-Book Builder şu anda "mikro-araç" (micro-tool) mantığıyla çalışmaktadır. Kullanıcı tuvale bir araç (Metin, Görsel, Soru) sürükler, o bloğa tıklar ve sadece o blok için yapay zekadan üretim ister.
Yeni Vizyon: Kullanıcı deneyimini bir üst seviyeye taşımak için "Tümleşik Sayfa Ajanı" fikri ortaya atılmıştır. Kullanıcının sayfanın altındaki genel bir sohbet kutusuna "Bana mitoz bölünme hakkında bir metin yaz, yanına mikroskop görüntüsü ekle, en alta da konuyu pekiştirecek 2 soru koy" diyerek tek bir komutla tüm sayfanın mizanpajını (satır/sütun) ve içeriklerini otomatik oluşturması hedeflenmiştir.

2. Karşılaşılan Mühendislik Zorlukları (Neden Doğrudan Çoklu-Ajan Kurmadık?)
Bu vizyonu gerçekleştirmek için akla ilk gelen yöntem, yapay zekayı bir "Çok Aşamalı Ajan" (Multi-step Agent) olarak kurgulamaktı. Ancak bu yaklaşım ciddi mimari darboğazlar yaratacaktı:

Zincirleme Aksiyon Kaosu (Chaining Complexity): Llama 3'ün sırayla önce metin aracını tetiklemesi, bitince görsel aracını çağırması, sonra soru aracını çağırması ve tüm bu asenkron işlemleri hafızasında (memory) kopmadan tutması gerekecekti. Bu, API limitlerini (Token Limit) anında doldurur ve sistemin çökme (timeout) riskini devasa oranda artırırdı.

Mizanpaj (Layout) Zorluğu: Yapay zekanın HTML DOM manipülasyonu yaparak (örneğin "Şimdi bir div aç, bunu flex-row yap, içine metni koy") arayüze doğrudan müdahale etmeye çalışması, güvenlik ve tasarım bütünlüğü açısından son derece tehlikeli ve kontrol edilemez bir yöntemdir (AI Hallucination riski).

3. Seçilen Çözüm: "JSON Tabanlı Sayfa Orkestratörü" Mimarisi
Sistemi karmaşık bir "Ajan zincirine" boğmak yerine, Sorumlulukların Ayrılığı (Separation of Concerns - SOLID) prensibine uygun, çok daha zarif ve yönetilebilir bir yol seçilmiştir.

Nasıl Çalışacak?

Yönetmen AI (Backend): Llama 3, içerikleri doğrudan üretmek veya araçları tek tek çağırmak yerine sadece bir "Mimar" görevi görecektir. Kullanıcının isteğini pedagojik olarak analiz edip, sayfanın nasıl görünmesi gerektiğini anlatan bir JSON Blueprint (Kroki) döndürecektir.

İnşaatçı Motor (Frontend Renderer): Arayüzümüz (app.js), gelen bu JSON krokisini okuyacak, satırları (row) ve sütunları oluşturacak, ardından her bir kutunun içine ne geleceğini belirleyip arka plandaki mevcut üretim API'lerimize (/api/generate) otonom (kendi kendine) istekler atacaktır.

4. Gelecek Geliştiricilere (Stajyerlere) Not: Neden Bu Yolu Seçtik?
Sevgili geliştirici, kodu incelerken "Neden Llama 3'e doğrudan sayfayı çizdirmediler de araya bir JSON katmanı koydular?" diye sorabilirsin. Sebepleri şunlardır:

Öngörülebilirlik (Determinism): LLM'ler (Büyük Dil Modelleri) HTML/CSS yazarken tasarımı bozma eğilimindedir. Tasarım kurallarını (CSS Grid/Flexbox) Frontend'de sabit tutup, LLM'e sadece veri (JSON) ürettirmek uygulamanın asla bozulmamasını sağlar.

Performans ve API Tasarrufu: Sayfadaki 5 farklı içeriği tek bir LLM isteğinde çözmek yerine, LLM sadece "planı" yapar. Frontend bu planı alıp içerikleri paralel olarak (Asenkron Fetch) üretir. Bu hem hızı 5 kat artırır hem de rate-limit (istek sınırı) hatalarını önler.

Modülerlik: Yarın sisteme yeni bir araç (Örn: "Ses Dosyası Bloğu") eklendiğinde, karmaşık yapay zeka ajanlarını eğitmek yerine sadece JSON şemamıza "type": "audio" eklemek yeterli olacaktır.