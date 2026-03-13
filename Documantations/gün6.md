JoedTech AI Platformu - Geliştirme ve Mimari Güncelleme Raporu
Proje: JoedTech AI E-Book Builder
Son Güncellemeler: Sistem Kararlılığı, Yapay Zeka Halüsinasyon Çözümleri ve Yeni Araç Entegrasyonları

1. Git ve Versiyon Kontrolü Optimizasyonu
Sorun: node_modules klasörünün ve içerisindeki gereksiz dosyaların (örn: .package-lock.json) uzak sunucuya (GitHub) gitmesi ve "Merge Conflict" (Birleştirme Çakışması) yaratması.

Çözüm: git rm -r --cached node_modules komutu ile Git hafızası temizlendi. Çakışan dosyalar için "Kendi Versiyonumuzu Tut" veya "Dosyayı Sil" stratejileri uygulanarak yerel ve uzak sunucu başarıyla eşitlendi (Senkronize edildi). Proje deposu tamamen temiz ve production-ready (canlıya çıkmaya hazır) hale getirildi.

2. Telif ve İntihal Motoru (Plagiarism Engine)
Eski Sistem: %50 ihtimalli rastgele uyarı veren bir simülasyon.

Yeni Sistem: Google Custom Search API entegrasyonu sağlandı.

Nasıl Çalışır: Sistem, sayfadaki metin bloklarını cümle bazında ayırıp Google üzerinde aratır. Birebir eşleşme bulduğunda, kopya içerik kaynağının doğrudan URL'sini (linkini) arayüze kırmızı bir uyarı kutusu ile yansıtır.

3. Gelişmiş Eğitim Motoru (Quiz Engine)
Yapay zekanın "Çok Gevezelik (AI Chattiness)" ve "Halüsinasyon" sorunları kökünden çözülerek, 4 farklı soru tipini destekleyen dinamik bir motor inşa edildi.

Dinamik Soru Tipleri: Arayüze "Çoktan Seçmeli", "Boşluk Doldurma", "Doğru/Yanlış" ve "Kısa Cevap" olmak üzere 4 alt menü eklendi.

Dinamik HTML Şablonları (Templates): Arka planda (index.js), seçilen soru türüne göre HTML çıktısı dinamikleştirildi. Örneğin; çoktan seçmeli de A,B,C,D şıkları gelirken, boşluk doldurmada metin kutusu (<input>) gelmesi sağlandı.

Halüsinasyon ve Çeldirici (Distractor) Yaması: LLM'in promptları sıkılaştırıldı. Yapay zekaya, "Sadece kullanıcının istediği şıkkı değiştir, diğer şıkları ve doğru cevabın yerini asla kaydırma" ve "Değiştirilen şıkkın KESİNLİKLE yanlış bir bilgi (çeldirici) olduğundan emin ol" gibi kesin askeri kurallar (Zero Tolerance) eklendi. Geveze giriş cümleleri engellendi.

4. Video Üretim Motoru Güncellemesi
Model Yükseltmesi: Replicate altyapısındaki video üretim modeli zeroscope-v2-xl sürümüne güncellendi. Daha kaliteli çıktılar için fps: 8, width: 512, height: 512 parametreleri sisteme entegre edildi.

5. Gelecek Vizyonu: Sayfa Orkestratörü (Page Orchestrator) Mimarisi
Projenin bir sonraki aşaması için "Çok Aşamalı Ajan" (Multi-step Agent) mimarisi tasarlandı.

Amaç: Kullanıcının tek bir komutuyla (Örn: "Mitoz bölünme sayfası yap ve sonuna 2 soru ekle") tüm sayfanın mizanpajının (satır/sütun) otomatik çizilmesi.

JSON Şeması: Llama 3'ün HTML üretmek yerine, sayfanın yapısını belirleyen özel bir JSON ("type": "row", "width": "half" vb.) döndürmesi ve arayüzün (Frontend Renderer) bu haritayı okuyarak blokları otomatik yerleştirmesi planlandı. Ayrıca yapay zekaya konunun pedagojik yapısına göre en uygun soru tipini seçme inisiyatifi (Karar Algoritması) verildi.