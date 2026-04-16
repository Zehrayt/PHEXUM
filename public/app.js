// public/app.js
import { generatePagePlan, generateBlockContent } from './api.js';
import { initCanvasCore, renderPageFromJSON, getActiveCanvasItem } from './canvas.js';
import { addAudioSupport } from './voice.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Arayüz Elementlerini Seç
    const uiElements = {
        canvas: document.getElementById('canvas'),
        emptyState: document.querySelector('.empty-state'),
        noSelectionMsg: document.getElementById('no-selection'),
        aiControls: document.getElementById('ai-controls'),
        selectedTypeBadge: document.getElementById('selected-type')
    };

    // 2. Tuvali Başlat
    initCanvasCore(uiElements);

    // 3. Sol Menü Sürükleme Başlatıcısı
    document.querySelectorAll(".tool-item").forEach(tool => {
        tool.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('type', tool.getAttribute('data-type'));
            e.dataTransfer.setData('name', tool.innerText);
        });
    });

    // 4. Sayfa Formatı Değiştirici
    const pageFormatSelect = document.getElementById('page-format');
    if (pageFormatSelect) {
        pageFormatSelect.addEventListener('change', (e) => {
            uiElements.canvas.className = 'format-' + e.target.value;
        });
    }

    // 5. YENİ SAYFA OLUŞTURMA BUTONU (Orkestratör)
    document.getElementById("generatePageBtn").addEventListener("click", async () => {
        const promptInput = document.getElementById("ai-prompt");
        const btn = document.getElementById("generatePageBtn"); 

        if (uiElements.aiControls.style.display === "none") {
            uiElements.aiControls.style.display = "block";
            uiElements.noSelectionMsg.style.display = "none";
            uiElements.selectedTypeBadge.innerText = "Tüm Sayfa";
            promptInput.focus();
            return; 
        }

        const prompt = promptInput.value;
        if (!prompt) return alert("Ne oluşturmak istediğini yaz 😄");

        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Mimari Çiziliyor...';
        btn.disabled = true; 
        btn.style.opacity = '0.7';
        btn.style.cursor = 'not-allowed';

        uiElements.canvas.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 300px; color: #4a5568;">
                <div style="font-size: 32px; margin-bottom: 15px; animation: bounce 1s infinite;">🏗️</div>
                <div style="font-weight: bold; font-size: 18px;">Yapay Zeka Sayfa Mimarisi Tasarlıyor...</div>
            </div>
            <style>@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }</style>
        `;

        try {
            const planData = await generatePagePlan(prompt);
            btn.innerHTML = '✨ İçerikler Üretiliyor...';
            await renderPageFromJSON(planData);
        } catch (err) {
            console.error(err);
            uiElements.canvas.innerHTML = `<div style="color: red; text-align: center; padding: 20px;">❌ Bir hata oluştu. Lütfen tekrar deneyin.</div>`;
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    });

    // 6. TEKİL BLOK ÜRETİM BUTONU (Mikro-Ajan)
    document.getElementById('btn-generate').addEventListener('click', async () => {
        const activeItem = getActiveCanvasItem();
        if(!activeItem) return;
        
        const prompt = document.getElementById('ai-prompt').value;
        const rawType = activeItem.getAttribute('data-type');
        let blockType = rawType;
        let questionType = null;

        if(rawType.startsWith("quiz-")){
            blockType = "quiz";
            questionType = rawType; 
        }
        
        const body = activeItem.querySelector('.item-body');
        body.innerHTML = `<span style="color: #666; font-style: italic;">⏳ Hazırlanıyor...</span>`;

        const data = await generateBlockContent(prompt, blockType, questionType);

        if (data.status === "SUCCESS") {
            if (data.content && data.content.trim() !== ""){
                body.innerHTML = "";
                const wrapper = document.createElement("div");
                wrapper.innerHTML = data.content;
                body.appendChild(wrapper);
                addAudioSupport(activeItem, body, rawType);
            } else {
                body.innerHTML = `<span style="color: gray;">İçerik üretilemedi</span>`;
            }
        } else if (data.status === "NO_ACTION") {
            let formattedText = data.message.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
            body.innerHTML = `<div style="line-height:1.6;color:#333;">${formattedText}</div>`;
        } else {
            body.innerHTML = `<span style="color: red;">🚨 ${data.message || 'Hata'}</span>`;
        }
    });

    // ==========================================
    // EKSİK OLAN SÜPERVİZÖR VE TELİF BUTONLARI
    // ==========================================

    // SÜPERVİZÖR: BÜTÜNLÜK ANALİZ MOTORU
    document.getElementById('btn-analyze').addEventListener('click', async () => {
        const items = document.querySelectorAll('.canvas-item');
        const reportDiv = document.getElementById('analysis-report');
        const btn = document.getElementById('btn-analyze');
        
        if (items.length === 0) return alert("Analiz edilecek içerik yok!");

        const pageData = [];
        items.forEach((item, index) => {
            const type = item.getAttribute('data-type');
            let content = item.innerText.replace('×', '').trim(); 
            if (type === 'image') {
                const imgTag = item.querySelector('img');
                if (imgTag && imgTag.getAttribute('alt')) content += ` (Görsel İçeriği: ${imgTag.getAttribute('alt')})`;
            }
            pageData.push(`[Blok ${index + 1} - Türü: ${type}]: ${content}`);
        });

        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Okunuyor...';
        btn.disabled = true;
        reportDiv.style.display = 'block';
        reportDiv.innerHTML = '<span style="color: #a0aec0; font-style: italic;">Yapay zeka tüm blokları inceliyor...</span>';

        document.querySelectorAll('.ai-suggestion-box').forEach(el => el.remove());

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pageContent: pageData.join('\n\n') })
            });
            const data = await response.json();
            let jsonStr = data.message.replace(/```json/g, '').replace(/```/g, '').trim();
            const analysisData = JSON.parse(jsonStr);
            
            reportDiv.innerHTML = `<div style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #2b6cb0;">🏆 Uyum Puanı: ${analysisData.score}</div><div>${analysisData.general_summary}</div>`;

            if (analysisData.improvements && analysisData.improvements.length > 0) {
                analysisData.improvements.forEach(imp => {
                    const targetBlock = items[imp.blockNumber - 1]; 
                    if (targetBlock) {
                        const suggestionDiv = document.createElement('div');
                        suggestionDiv.className = 'ai-suggestion-box';
                        suggestionDiv.style.cssText = "margin-top: 15px; padding: 12px; background: #fffbeb; border: 1px solid #f6e05e; border-radius: 6px; font-size: 12px;";
                        suggestionDiv.innerHTML = `
                            <div style="font-weight: bold; margin-bottom: 5px;">💡 Süpervizör Tavsiyesi:</div>
                            <div style="margin-bottom: 10px;">${imp.reason}</div>
                            <div style="display: flex; gap: 10px; align-items: center; background: #fefcbf; padding: 8px; border-radius: 4px;">
                                <span style="flex: 1; font-style: italic; color: #975a16;">" ${imp.suggestedPrompt} "</span>
                                <button onclick="applySuggestion(${imp.blockNumber - 1}, '${imp.suggestedPrompt.replace(/'/g, "\\'")}')" style="background: #ecc94b; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px;">Uygula</button>
                            </div>
                        `;
                        targetBlock.appendChild(suggestionDiv);
                    }
                });
            } else {
                reportDiv.innerHTML += `<br><br><span style="color: #38a169; font-weight: bold;">✅ Tüm bloklar uyumlu.</span>`;
            }
        } catch (error) {
            reportDiv.innerHTML = `<span style="color: red;">❌ Analiz sonucu okunamadı.</span>`;
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    // GÜVENLİK MOTORU: TELİF KONTROLÜ BUTONU
    document.getElementById('btn-copyright').addEventListener('click', async () => {
        const items = document.querySelectorAll('.canvas-item');
        const reportDiv = document.getElementById('analysis-report');
        const btn = document.getElementById('btn-copyright');
        
        const textData = [];
        items.forEach((item) => {
            const type = item.getAttribute('data-type');
            if (type === 'text' || type.startsWith('quiz')) {
                textData.push(item.innerText.replace('×', '').trim());
            }
        });

        if (textData.length === 0) return alert("Metin veya soru bloğu bulunamadı!");

        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Taranıyor...';
        btn.disabled = true;
        reportDiv.style.display = 'block';
        reportDiv.innerHTML = '<span style="color: #a0aec0; font-style: italic;">Web kaynakları taranıyor...</span>';

        try {
            const response = await fetch('/api/check-copyright', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ textContent: textData.join('\n\n') })
            });
            const data = await response.json();
            reportDiv.innerHTML = data.message;
        } catch (error) {
            reportDiv.innerHTML = `<span style="color: red;">❌ Sunucuya bağlanılamadı.</span>`;
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    // PDF Kaydetme
    document.getElementById('btn-export').addEventListener('click', () => window.print());

    // Otomatik Doldurma Global Fonksiyonu (Süpervizör için)
    window.applySuggestion = (index, promptText) => {
        const items = document.querySelectorAll('.canvas-item');
        if(items[index]) {
            items[index].click(); 
            document.getElementById('ai-prompt').value = promptText;
            const genBtn = document.getElementById('btn-generate');
            genBtn.style.transform = "scale(1.05)";
            setTimeout(() => genBtn.style.transform = "scale(1)", 800);
        }
    };
});