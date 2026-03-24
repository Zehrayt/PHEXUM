let selectedQuestionType = null;

document.querySelectorAll(".tool-item").forEach(btn=>{
    btn.addEventListener("click",()=>{
        const type = btn.getAttribute("data-type");

        if(type && type.startsWith("quiz-")){
            selectedQuestionType = type.replace("quiz-","");
            console.log("Seçilen soru tipi:", selectedQuestionType);
        }
    })
})

document.addEventListener('DOMContentLoaded', () => {
    const tools = document.querySelectorAll('.tool-item');
    const canvas = document.getElementById('canvas');
    const emptyState = document.querySelector('.empty-state');
    
    // Sağ Panel Elementleri
    const noSelectionMsg = document.getElementById('no-selection');
    const aiControls = document.getElementById('ai-controls');
    const selectedTypeBadge = document.getElementById('selected-type');
    let activeCanvasItem = null;

    // Sayfa formatı değiştirme olayını dinle
    const pageFormatSelect = document.getElementById('page-format');
    if (pageFormatSelect) {
        pageFormatSelect.addEventListener('change', (e) => {
            // Tuvali bul ve eski format sınıflarını temizleyip yenisini ekle
            canvas.classList.remove('format-a4', 'format-a3', 'format-a5');
            canvas.classList.add('format-' + e.target.value);
        });
    }

    // 1. Sürükleme Başlangıcı
    tools.forEach(tool => {
        tool.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('type', tool.getAttribute('data-type'));
            e.dataTransfer.setData('name', tool.innerText);
        });
    });

    function generateQuestion(type){

        const prompt = document.getElementById("ai-prompt").value;

        fetch("/api/generate",{
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify({
                prompt:prompt,
                blockType:"quiz",
                questionType:type
            })
        })
    }

    // 2. Tuval Üzerine Gelme (İzin ver)
    canvas.addEventListener('dragover', (e) => {
        e.preventDefault(); // Varsayılan engellemeyi kaldır ki bırakabilelim
        canvas.style.backgroundColor = "#f0fdf4"; // Bırakılabilir hissi ver
    });

    canvas.addEventListener('dragleave', () => {
        canvas.style.backgroundColor = "white";
    });

    // 3. Tuvale Bırakma
    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        canvas.style.backgroundColor = "white";
        if (emptyState) emptyState.style.display = 'none';

        const type = e.dataTransfer.getData('type');
        const name = e.dataTransfer.getData('name');

        if(type) {
            createCanvasItem(type, name);
        }
    });

    // Tuvale yeni bir öğe ekleme fonksiyonu
    function createCanvasItem(type, name) {
        const item = document.createElement('div');
        item.classList.add('canvas-item', 'w-full');
        item.setAttribute('data-type', type);
        
        // Çöp kutusu (Her zaman kalacak)
        const delBtn = document.createElement('button');
        delBtn.innerHTML = '×';
        delBtn.className = 'delete-btn';
        delBtn.onclick = (e) => { e.stopPropagation(); item.remove(); };
        item.appendChild(delBtn);

        // İÇERİK ALANI (Yapay zeka buraya yazacak)
        const contentDiv = document.createElement('div');
        contentDiv.className = 'item-body'; // Bu sınıfa yazdıracağız
        contentDiv.innerHTML = `<span style="color: #999;">[Boş ${name}] - Üretmek için tıklayın.</span>`;
        item.appendChild(contentDiv);
/*
        // Çift tıklama ile metin düzenleme özelliğini ekle
        contentDiv.addEventListener('dblclick', (e) => {
            // Eğer blokta sadece metin varsa düzenlemeye izin ver (Resim/Video değilse)
            if (type === 'text' || type.startsWith('quiz')) {
                const currentText = contentDiv.innerHTML.replace(/<br>/g, '\n');
                const textarea = document.createElement('textarea');
                textarea.style.width = '100%';
                textarea.style.height = contentDiv.clientHeight + 'px';
                textarea.style.fontFamily = 'inherit';
                textarea.style.fontSize = 'inherit';
                textarea.value = currentText.replace(/<\/?[^>]+(>|$)/g, ""); // HTML etiketlerini temizle
                
                contentDiv.innerHTML = '';
                contentDiv.appendChild(textarea);
                textarea.focus();

                // Odak kaybolduğunda (blur) veya Enter'a basıldığında kaydet
                textarea.addEventListener('blur', () => {
                    contentDiv.innerHTML = textarea.value.replace(/\n/g, '<br>');
                });

                textarea.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        textarea.blur();
                    }
                });
            }
        });*/

        if (type === 'text') {
                        contentDiv.setAttribute('contenteditable', 'true');
                        contentDiv.style.outline = 'none'; // Tıklayınca çirkin mavi çerçeve çıkmasın
                        contentDiv.style.cursor = 'text'; // Fareyle üzerine gelince yazma imleci çıksın
                    }

        item.onclick = (e) => {
            e.stopPropagation();
            selectItem(item, type, name);
        };

        canvas.appendChild(item);
        // Yeni bloğa sıralama olaylarını bağla
        addReorderEvents(item);
    }

    // --- Blok Sıralama (Reorder) Özelliği ---
    let dragSourceItem = null;

    function addReorderEvents(item) {
        item.setAttribute('draggable', 'true');

        item.addEventListener('dragstart', (e) => {
            // Eğer bir tool-item sürüklemiyorsak (yani canvas-item ise)
            if (item.classList.contains('canvas-item')) {
                dragSourceItem = item;
                item.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
            }
        });

        item.addEventListener('dragend', () => {
            item.style.opacity = '1';
            canvas.classList.remove('drag-over-active');
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            if (dragSourceItem && dragSourceItem !== item) {
                const bounding = item.getBoundingClientRect();
                const offset = e.clientY - bounding.top + (bounding.height / 2);
                
                // Eğer farenin konumu öğenin yarısından aşağıdaysa sonrasına, değilse öncesine ekle
                if (e.clientY > bounding.top + bounding.height / 2) {
                    item.parentNode.insertBefore(dragSourceItem, item.nextSibling);
                } else {
                    item.parentNode.insertBefore(dragSourceItem, item);
                }
            }
        });
    }

    // Bir öğeyi seçme ve sağ paneli hazırlama
    function selectItem(item, type, name) {
        // Eski seçilinin rengini temizle
        if (activeCanvasItem) activeCanvasItem.classList.remove('active');
        
        // Yenisini aktifleştir
        activeCanvasItem = item;
        activeCanvasItem.classList.add('active');

        // Sağ paneli göster
        noSelectionMsg.style.display = 'none';
        aiControls.style.display = 'block';
        selectedTypeBadge.innerText = `Seçilen: ${name}`;

        const sizeControls = `
            <div style="margin-top:15px; border-top:1px solid #eee; padding-top:10px;">
                <label style="font-size:12px; font-weight:bold;">Blok Genişliği:</label>
                <div style="display:flex; gap:5px; margin-top:5px;">
                    <button onclick="updateWidth('full')" style="flex:1; font-size:11px;">Tam</button>
                    <button onclick="updateWidth('half')" style="flex:1; font-size:11px;">1/2</button>
                    <button onclick="updateWidth('third')" style="flex:1; font-size:11px;">1/3</button>
                </div>
            </div>
        `;

        // ai-controls içine bu sizeControls'u yerleştir
        const controlsDiv = document.getElementById('ai-controls');
        if(!document.getElementById('size-control-wrap')) {
            const wrap = document.createElement('div');
            wrap.id = 'size-control-wrap';
            wrap.innerHTML = sizeControls;
            controlsDiv.appendChild(wrap);
        }
    }

    window.updateWidth = (size) => {
        const activeItem = document.querySelector('.canvas-item.active');
        if(!activeItem) return;
        activeItem.classList.remove('w-full', 'w-half', 'w-third');
        activeItem.classList.add('w-' + size);
    };

    // Tuvalde boşluğa tıklanınca seçimi kaldır
    canvas.addEventListener('click', () => {
        if (activeCanvasItem) activeCanvasItem.classList.remove('active');
        activeCanvasItem = null;
        noSelectionMsg.style.display = 'block';
        aiControls.style.display = 'none';
    });

    // AI Üret Butonu (Şimdilik sahte, backend'e bağlayacağız)
    // GERÇEK API BAĞLANTISI (btn-generate tıklanınca çalışır)
    document.getElementById('btn-generate').addEventListener('click', async () => {
        if(!activeCanvasItem) return;
        const prompt = document.getElementById('ai-prompt').value;
        const rawType = activeCanvasItem.getAttribute('data-type');

        let blockType = rawType;
        let questionType = null;

        if(rawType.startsWith("quiz-")){
            blockType = "quiz"; // 1. Backend'deki ana "quiz" kapısını açmak için
            questionType = rawType; // 2. İçerideki "quiz-mcq" gibi alt soru tiplerini seçmek için
        }
        
        const body = activeCanvasItem.querySelector('.item-body');
        body.innerHTML = `<span style="color: #666; font-style: italic;">⏳ Soru Seti Hazırlanıyor...</span>`;

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt,
                    blockType: blockType,
                    questionType: questionType
                })
            });

            const data = await response.json();

            if (data.status === "NO_ACTION") {
                let formattedText = data.message
                    .replace(/\n/g, '<br>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>');

                body.innerHTML = `<div style="line-height: 1.6; color: #333;">${formattedText}</div>`;
            } else if (data.status === "SUCCESS") {
                if (data.data && data.data.html) {
                    body.innerHTML = data.data.html;
                } else {
                    body.innerHTML = `<div style="padding: 10px; background: #f0fdf4; border-left: 4px solid #4ade80;">
                        <strong>✅ İşlem Başarılı:</strong><br>
                        <pre style="font-size: 11px; margin-top: 5px;">${JSON.stringify(data.data, null, 2)}</pre>
                    </div>`;
                }
            } else {
                body.innerHTML = `<span style="color: #e53e3e;">🚨 Hata: ${data.message}</span>`;
            }
        } catch (error) {
            body.innerHTML = `<span style="color: red;">❌ Bağlantı hatası!</span>`;
        }
    });

    // PDF Kaydetme Butonu
    document.getElementById('btn-export').addEventListener('click', () => {
        window.print();
    });

    // SÜPERVİZÖR: BÜTÜNLÜK ANALİZ MOTURU
    document.getElementById('btn-analyze').addEventListener('click', async () => {
        const items = document.querySelectorAll('.canvas-item');
        const reportDiv = document.getElementById('analysis-report');
        const btn = document.getElementById('btn-analyze');
        
        if (items.length === 0) {
            alert("Analiz edilecek içerik yok! Lütfen tuvale önce bir şeyler ekleyin.");
            return;
        }

        const pageData = [];
        items.forEach((item, index) => {
            const type = item.getAttribute('data-type');
            let content = item.innerText.replace('×', '').trim(); 
            
            if (type === 'image') {
                const imgTag = item.querySelector('img');
                if (imgTag && imgTag.getAttribute('alt')) {
                    content += ` (Görsel İçeriği: ${imgTag.getAttribute('alt')})`;
                }
            }
            pageData.push(`[Blok ${index + 1} - Türü: ${type}]: ${content}`);
        });

        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Süpervizör Sayfayı Okuyor...';
        btn.disabled = true;
        reportDiv.style.display = 'block';
        reportDiv.innerHTML = '<span style="color: #a0aec0; font-style: italic;">Yapay zeka tüm blokları inceliyor, lütfen bekleyin...</span>';

        // Eski tavsiye kutularını temizle
        document.querySelectorAll('.ai-suggestion-box').forEach(el => el.remove());

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pageContent: pageData.join('\n\n') })
            });

            const data = await response.json();
            
            // LLM'den gelen JSON metnini temizleyip JavaScript objesine çeviriyoruz
            let jsonStr = data.message.replace(/```json/g, '').replace(/```/g, '').trim();
            const analysisData = JSON.parse(jsonStr);
            
            // 1. Ana Raporu Sağ Panele Yaz
            reportDiv.innerHTML = `
                <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #2b6cb0;">🏆 Uyum Puanı: ${analysisData.score}</div>
                <div>${analysisData.general_summary}</div>
            `;

            // 2. Tavsiyeleri İlgili Blokların Altına Ekle
            if (analysisData.improvements && analysisData.improvements.length > 0) {
                analysisData.improvements.forEach(imp => {
                    // blockNumber 1'den başlar, items dizisi 0'dan başlar
                    const targetBlock = items[imp.blockNumber - 1]; 
                    
                    if (targetBlock) {
                        const suggestionDiv = document.createElement('div');
                        suggestionDiv.className = 'ai-suggestion-box';
                        suggestionDiv.style.cssText = "margin-top: 15px; padding: 12px; background: #fffbeb; border: 1px solid #f6e05e; border-radius: 6px; font-size: 12px; color: #744210; box-shadow: 0 2px 4px rgba(0,0,0,0.05);";
                        
                        suggestionDiv.innerHTML = `
                            <div style="font-weight: bold; margin-bottom: 5px;">💡 Süpervizör Tavsiyesi:</div>
                            <div style="margin-bottom: 10px;">${imp.reason}</div>
                            <div style="display: flex; gap: 10px; align-items: center; background: #fefcbf; padding: 8px; border-radius: 4px;">
                                <span style="flex: 1; font-style: italic; color: #975a16;">" ${imp.suggestedPrompt} "</span>
                                <button onclick="applySuggestion(${imp.blockNumber - 1}, '${imp.suggestedPrompt.replace(/'/g, "\\'")}')" style="background: #ecc94b; color: #744210; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px; white-space: nowrap;">Hemen Uygula</button>
                            </div>
                        `;
                        targetBlock.appendChild(suggestionDiv);
                    }
                });
            } else {
                reportDiv.innerHTML += `<br><br><span style="color: #38a169; font-weight: bold;">✅ Harika iş! Tüm bloklar birbiriyle mükemmel uyum içinde.</span>`;
            }

        } catch (error) {
            console.error(error);
            reportDiv.innerHTML = `<span style="color: red;">❌ Analiz sonucu okunamadı. Yapay zeka JSON formatını bozmuş olabilir.</span>`;
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    // Tavsiyedeki promptu otomatik dolduran Global Fonksiyon (En alta ekle)
    window.applySuggestion = (index, promptText) => {
        const items = document.querySelectorAll('.canvas-item');
        if(items[index]) {
            // Bloğu otomatik seç (tıklama simülasyonu)
            items[index].click(); 
            // Prompt kutusunu doldur
            document.getElementById('ai-prompt').value = promptText;
            // Kullanıcının dikkatini sağdaki "Yapay Zeka İle Üret" butonuna çek
            const genBtn = document.getElementById('btn-generate');
            genBtn.style.transform = "scale(1.05)";
            genBtn.style.boxShadow = "0 0 15px rgba(66, 153, 225, 0.6)";
            setTimeout(() => {
                genBtn.style.transform = "scale(1)";
                genBtn.style.boxShadow = "none";
            }, 800);
        }
    };

    // ---------------------------------------------------------
    // ©️ GÜVENLİK MOTORU: TELİF KONTROLÜ BUTONU
    // ---------------------------------------------------------
    document.getElementById('btn-copyright').addEventListener('click', async () => {
        const items = document.querySelectorAll('.canvas-item');
        const reportDiv = document.getElementById('analysis-report');
        const btn = document.getElementById('btn-copyright');
        
        // SADECE metin ve soru bloklarını topluyoruz
        const textData = [];
        items.forEach((item) => {
            const type = item.getAttribute('data-type');
            if (type === 'text' || type.startsWith('quiz')) {
                const content = item.innerText.replace('×', '').trim();
                textData.push(content);
            }
        });

        if (textData.length === 0) {
            alert("Telif kontrolü yapılacak metin veya soru bloğu bulunamadı!");
            return;
        }

        // Yükleniyor durumu
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ İnternet Taranıyor...';
        btn.disabled = true;
        reportDiv.style.display = 'block';
        reportDiv.innerHTML = '<span style="color: #a0aec0; font-style: italic;">Dünya çapındaki web kaynakları taranıyor, lütfen bekleyin...</span>';

        try {
            const response = await fetch('/api/check-copyright', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ textContent: textData.join('\n\n') })
            });

            const data = await response.json();
            
            // Sonucu analiz raporu kutusuna bas
            reportDiv.innerHTML = data.message;

        } catch (error) {
            reportDiv.innerHTML = `<span style="color: red;">❌ Sunucuya bağlanırken hata oluştu.</span>`;
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    document.getElementById("generatePageBtn").addEventListener("click", async () => {

        const aiPanel = document.getElementById("ai-controls");
        const noSel = document.getElementById("no-selection");
        const promptInput = document.getElementById("ai-prompt");

        // 🔥 Panel kapalıysa aç (ilk tıklama)
        if (aiPanel.style.display === "none") {
            aiPanel.style.display = "block";
            noSel.style.display = "none";
            document.getElementById("selected-type").innerText = "Tüm Sayfa";

            promptInput.focus();
            return; // ❗ hemen üretme
        }

        // 🔥 Panel açıksa → üret (ikinci tıklama)
        const prompt = promptInput.value;

        if (!prompt) {
            alert("Ne oluşturmak istediğini yaz 😄");
            return;
        }

        try {
            const res = await fetch("/api/page-plan", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    prompt: prompt + " Bu konu için öğretici ve düzenli bir sayfa oluştur."
                })
            });

            const data = await res.json();

            renderPageFromJSON(data);

        } catch (err) {
            console.error(err);
            alert("Hata oluştu");
        }
    });


    function renderPageFromJSON(plan) {
        const canvas = document.getElementById("canvas");
        
        // Önceki tuvali tamamen temizle
        canvas.innerHTML = ''; 
        const emptyState = document.querySelector('.empty-state');
        if (emptyState) emptyState.style.display = 'none';

        plan.layout.forEach(row => {
            const rowDiv = document.createElement("div");
            rowDiv.style.display = "flex";
            rowDiv.style.gap = "15px";
            rowDiv.style.marginBottom = "15px";
            rowDiv.style.width = "100%";

            row.children.forEach(block => {
                const repeat = block.count || 1;

                for (let i = 0; i < repeat; i++) {
                    const type = block.type;
                    let name = "AI Bloğu";
                    if (type === "text") name = "Metin Bloğu";
                    if (type === "image") name = "AI Görsel";
                    if (type.startsWith("quiz")) name = "AI Soru Seti";

                    // 1. Kutuyu Standartlarımıza Göre Yaratıyoruz
                    const item = document.createElement('div');
                    item.classList.add('canvas-item');
                    item.style.flex = "1"; // Satır içinde esneklik
                    item.setAttribute('data-type', type);

                    // 2. Çöp Kutusu Ekle
                    const delBtn = document.createElement('button');
                    delBtn.innerHTML = '×';
                    delBtn.className = 'delete-btn';
                    delBtn.onclick = (e) => { e.stopPropagation(); item.remove(); };
                    item.appendChild(delBtn);

                    // 3. İÇERİK ALANI (Metinlerin yazılacağı yer)
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'item-body';
                    contentDiv.innerHTML = `<span style="color: #666; font-style: italic;">⏳ Yapay Zeka Çiziyor...</span>`;
                    item.appendChild(contentDiv);
                    /*
                    // 🔥 SİHİR 1: Çift Tıklama İle Manuel Düzenleme
                    contentDiv.addEventListener('dblclick', (e) => {
                        if (type === 'text' || type.startsWith('quiz')) {
                            const currentText = contentDiv.innerHTML.replace(/<br>/g, '\n');
                            const textarea = document.createElement('textarea');
                            textarea.style.width = '100%';
                            textarea.style.height = contentDiv.clientHeight + 'px';
                            textarea.style.fontFamily = 'inherit';
                            textarea.style.fontSize = 'inherit';
                            textarea.value = currentText.replace(/<\/?[^>]+(>|$)/g, ""); // HTML'i temizle
                            
                            contentDiv.innerHTML = '';
                            contentDiv.appendChild(textarea);
                            textarea.focus();

                            textarea.addEventListener('blur', () => {
                                contentDiv.innerHTML = textarea.value.replace(/\n/g, '<br>');
                            });
                            textarea.addEventListener('keydown', (e) => {
                                if (e.key === 'Enter' && !e.shiftKey) textarea.blur();
                            });
                        }
                    });*/

                    if (type === 'text') {
                        contentDiv.setAttribute('contenteditable', 'true');
                        contentDiv.style.outline = 'none'; // Tıklayınca çirkin mavi çerçeve çıkmasın
                        contentDiv.style.cursor = 'text'; // Fareyle üzerine gelince yazma imleci çıksın
                    }

                    // 🔥 SİHİR 2: Tıklama İle Seçme ve Sağ Paneli Açma
                    item.onclick = (e) => {
                        e.stopPropagation();
                        // app.js'in üstlerindeki global seçme fonksiyonunu tetikliyoruz
                        selectItem(item, type, name); 
                    };

                    // Sıralama (Sürükle bırak) olayını ekle
                    if (typeof addReorderEvents === "function") {
                        addReorderEvents(item);
                    }

                    rowDiv.appendChild(item);

                    // 4. Bloğun içini doldurması için Yapay Zekaya gönder!
                    generateContent(contentDiv, block);
                }
            });

            canvas.appendChild(rowDiv);
        });
    }

    async function generateContent(container, block) {
        try {
            let type = block.type;
            let prompt = block.content || block.prompt || "Bu konu hakkında açıklayıcı içerik üret.";

            // Soru tiplerini Backend'in anlayacağı şekle çevir
            if (type && type.startsWith("quiz")) {
                type = "quiz";
                if (block.type === "quiz-mcq") prompt += " 4 şıklı çoktan seçmeli, farklı bir soru üret.";
                if (block.type === "quiz-fill") prompt += " Boşluk doldurma formatında, farklı bir soru üret.";
                if (block.type === "quiz-truefalse") prompt += " Doğru/Yanlış formatında, farklı bir soru üret.";
                if (block.type === "quiz-short") prompt += " Kısa cevaplı, farklı bir soru üret.";
            }

            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: prompt, blockType: type, questionType: block.type })
            });

            const data = await res.json();

            // Sadece başarılı dönen HTML'i kutunun içine bas
            if (data.status === "NO_ACTION") {
                container.innerHTML = data.message;
            } else {
                container.innerHTML = `<span style="color: #e53e3e;">🚨 Yapay zeka yanıt veremedi.</span>`;
            }

        } catch (err) {
            container.innerHTML = `<span style="color: red;">❌ İnternet veya bağlantı hatası</span>`;
        }
    }

}); 


