import { generateBlockContent } from './api.js';
import { addAudioSupport, initVoiceSummaryBlock } from './voice.js';

let activeCanvasItem = null;
let dragSourceItem = null;
let uiElements = {};

// Tuvali başlatan ana fonksiyon
export function initCanvasCore(elements) {
    uiElements = elements;

    uiElements.canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        uiElements.canvas.style.backgroundColor = "#f0fdf4";
    });

    uiElements.canvas.addEventListener('dragleave', () => {
        uiElements.canvas.style.backgroundColor = "white";
    });

    uiElements.canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        uiElements.canvas.style.backgroundColor = "white";
        if (uiElements.emptyState) uiElements.emptyState.style.display = 'none';

        const type = e.dataTransfer.getData('type');
        const name = e.dataTransfer.getData('name');
        if (type) createCanvasItem(type, name);
    });

    uiElements.canvas.addEventListener('click', () => {
        if (activeCanvasItem) activeCanvasItem.classList.remove('active');
        activeCanvasItem = null;
        uiElements.noSelectionMsg.style.display = 'block';
        uiElements.aiControls.style.display = 'none';
    });
}

export function getActiveCanvasItem() {
    return activeCanvasItem;
}

// Arayüze manuel yeni kutu ekleyen fonksiyon
export function createCanvasItem(type, name) {
    const item = document.createElement('div');
    item.classList.add('canvas-item', 'w-full');
    item.style.display = "flex";          
    item.style.flexDirection = "column";
    item.setAttribute('data-type', type);
    
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '×';
    delBtn.className = 'delete-btn';
    delBtn.onclick = (e) => { e.stopPropagation(); item.remove(); };
    item.appendChild(delBtn);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'item-body';
    contentDiv.style.flex = "1";
    item.appendChild(contentDiv);

    // 🔥 GÖREV 3 BURAYA EKLENDİ: Eğer sürüklenen şey Sesli Özet ise!
    if (type === 'voice-summary') {
        initVoiceSummaryBlock(contentDiv);
    } else {
        // Normal bir bloksa boş metnini yazdır
        contentDiv.innerHTML = `<span style="color: #999;">[Boş ${name}] - Üretmek için tıklayın.</span>`;
    }

    if (type === 'text') {
        contentDiv.setAttribute('contenteditable', 'true');
        contentDiv.style.outline = 'none';
        contentDiv.style.cursor = 'text';
    }

    item.onclick = (e) => {
        e.stopPropagation();
        selectItem(item, type, name);
    };

    uiElements.canvas.appendChild(item);
    addReorderEvents(item);
}

// Blok sıralama motoru
function addReorderEvents(item) {
    item.setAttribute('draggable', 'true');
    item.addEventListener('dragstart', (e) => {
        if (item.classList.contains('canvas-item')) {
            dragSourceItem = item;
            item.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
        }
    });
    item.addEventListener('dragend', () => {
        item.style.opacity = '1';
        uiElements.canvas.classList.remove('drag-over-active');
    });
    item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragSourceItem && dragSourceItem !== item) {
            const bounding = item.getBoundingClientRect();
            if (e.clientY > bounding.top + bounding.height / 2) {
                item.parentNode.insertBefore(dragSourceItem, item.nextSibling);
            } else {
                item.parentNode.insertBefore(dragSourceItem, item);
            }
        }
    });
}

function selectItem(item, type, name) {
    if (activeCanvasItem) activeCanvasItem.classList.remove('active');
    activeCanvasItem = item;
    activeCanvasItem.classList.add('active');

    uiElements.noSelectionMsg.style.display = 'none';
    uiElements.aiControls.style.display = 'block';
    uiElements.selectedTypeBadge.innerText = `Seçilen: ${name}`;

    const sizeControls = `
        <div style="margin-top:15px; border-top:1px solid #eee; padding-top:10px;">
            <label style="font-size:12px; font-weight:bold;">Blok Genişliği:</label>
            <div style="display:flex; gap:5px; margin-top:5px;">
                <button onclick="window.updateWidth('full')" style="flex:1; font-size:11px;">Tam</button>
                <button onclick="window.updateWidth('half')" style="flex:1; font-size:11px;">1/2</button>
                <button onclick="window.updateWidth('third')" style="flex:1; font-size:11px;">1/3</button>
            </div>
        </div>
    `;
    if (!document.getElementById('size-control-wrap')) {
        const wrap = document.createElement('div');
        wrap.id = 'size-control-wrap';
        wrap.innerHTML = sizeControls;
        uiElements.aiControls.appendChild(wrap);
    }
}

window.updateWidth = (size) => {
    const activeItem = document.querySelector('.canvas-item.active');
    if (!activeItem) return;
    activeItem.classList.remove('w-full', 'w-half', 'w-third');
    activeItem.classList.add('w-' + size);
};

// Arkadaşının Mükemmel Orkestratör Render Fonksiyonu
export async function renderPageFromJSON(plan) {

    if (!plan || !plan.layout) {
        throw new Error("Geçersiz sayfa planı! Yapay zeka doğru formatta yanıt vermedi.");
    }

    uiElements.canvas.innerHTML = ''; 
    if (uiElements.emptyState) uiElements.emptyState.style.display = 'none';

    for (const row of plan.layout) {
        const rowDiv = document.createElement("div");
        rowDiv.style.display = "flex";
        rowDiv.style.gap = "15px";
        rowDiv.style.marginBottom = "15px";
        rowDiv.style.width = "100%";
        rowDiv.style.alignItems = "stretch";

        for (const block of row.children) {
            const repeat = block.count || 1;
            for (let i = 0; i < repeat; i++) {
                const type = block.type;
                let name = type === "text" ? "Metin Bloğu" : type === "image" ? "AI Görsel" : "AI Soru Seti";

                const item = document.createElement('div');
                item.classList.add('canvas-item');
                item.style.flex = "1"; 
                item.style.display = "flex";          
                item.style.flexDirection = "column";
                item.setAttribute('data-type', type);

                const delBtn = document.createElement('button');
                delBtn.innerHTML = '×';
                delBtn.className = 'delete-btn';
                delBtn.onclick = (e) => { e.stopPropagation(); item.remove(); };
                item.appendChild(delBtn);

                const contentDiv = document.createElement('div');
                contentDiv.className = 'item-body';
                contentDiv.style.flex = "1";
                item.appendChild(contentDiv);

                // 🔥 GÖREV 3 BURAYA EKLENDİ: Orkestratör çizerken
                if (type === 'voice-summary') {
                    initVoiceSummaryBlock(contentDiv);
                } else {
                    contentDiv.innerHTML = `<span style="color: #666; font-style: italic;">⏳ Yapay Zeka Çiziyor...</span>`;
                }

                if (type === 'text') {
                    contentDiv.setAttribute('contenteditable', 'true');
                    contentDiv.style.outline = 'none';
                    contentDiv.style.cursor = 'text';
                }

                item.onclick = (e) => { e.stopPropagation(); selectItem(item, type, name); };
                addReorderEvents(item);
                rowDiv.appendChild(item);

                // 🔥 DÜZELTME: generateContent'e "item" parametresini de yolladık
                await generateContent(item, contentDiv, block);
            }
        }
        uiElements.canvas.appendChild(rowDiv);
    }
}

// 🔥 DÜZELTME: İlk parametre olarak "item" eklendi
export async function generateContent(item, container, block) {
    try {
        const rawType = block.type;
        let type = rawType;
        let prompt = block.content || block.prompt || "Bu konu hakkında içerik üret.";

        if (type && type.startsWith("quiz")) {
            type = "quiz";
            if (block.type === "quiz-mcq") prompt += " 4 şıklı çoktan seçmeli, farklı bir soru üret.";
            if (block.type === "quiz-fill") prompt += " Boşluk doldurma formatında, farklı bir soru üret.";
            if (block.type === "quiz-truefalse") prompt += " Doğru/Yanlış formatında, farklı bir soru üret.";
            if (block.type === "quiz-short") prompt += " Kısa cevaplı, farklı bir soru üret.";
        }

        const data = await generateBlockContent(prompt, type, rawType);

        if (data.status === "SUCCESS") {
            
            container.innerHTML = data.content;

            // 🔥 KRİTİK DÜZELTME: Sesli özet değilse ses desteği ekle
            if (rawType !== 'voice-summary') {
                addAudioSupport(item, container, rawType);
            }

        } else if (data.status === "NO_ACTION") {
            let formattedText = data.message.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
            container.innerHTML = `<div style="line-height:1.6;color:#333;">${formattedText}</div>`;
        } else {
            container.innerHTML = `<span style="color:red;">🚨 ${data.message || 'Bilinmeyen Hata'}</span>`;
        }
    } catch (err) {
        container.innerHTML = `<span style="color: red;">❌ İnternet veya bağlantı hatası</span>`;
    }
}