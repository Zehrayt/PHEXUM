document.addEventListener('DOMContentLoaded', () => {
    const tools = document.querySelectorAll('.tool-item');
    const canvas = document.getElementById('canvas');
    const emptyState = document.querySelector('.empty-state');
    
    // Sağ Panel Elementleri
    const noSelectionMsg = document.getElementById('no-selection');
    const aiControls = document.getElementById('ai-controls');
    const selectedTypeBadge = document.getElementById('selected-type');
    let activeCanvasItem = null;

    // 1. Sürükleme Başlangıcı
    tools.forEach(tool => {
        tool.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('type', tool.getAttribute('data-type'));
            e.dataTransfer.setData('name', tool.innerText);
        });
    });

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

    // Tuvale yeni blok ekleme fonksiyonu
    function createCanvasItem(type, name) {
        const item = document.createElement('div');
        item.classList.add('canvas-item');
        item.setAttribute('data-type', type);
        item.innerText = `[Boş ${name}] - Yapay zeka ile içerik üretmek için tıklayın.`;

        // Öğeye tıklandığında sağ paneli aç
        item.addEventListener('click', (e) => {
            e.stopPropagation(); // Tuval tıklamasını engelle
            selectItem(item, type, name);
        });

        canvas.appendChild(item);
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
    }

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
        const blockType = activeCanvasItem.getAttribute('data-type');
        
        // Kullanıcıya yüklendiğini gösterelim
        activeCanvasItem.innerHTML = `<span style="color: #666; font-style: italic;">⏳ "${prompt}" yapay zeka tarafından üretiliyor... Lütfen bekleyin.</span>`;
        
        try {
            // Node.js (Express) sunucumuza isteği atıyoruz
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: prompt, blockType: blockType })
            });

            const data = await response.json();

            // AI'dan gelen cevabı ekrana basıyoruz
            if (data.status === "SUCCESS") {
                // Eğer bir sistem aracı (Tool) çalıştıysa
                activeCanvasItem.innerHTML = `<div style="padding: 10px; background: #f0fdf4; border-left: 4px solid #4ade80;">
                    <strong>✅ Sistem İşlemi Başarılı:</strong><br>
                    <pre style="font-size: 11px; margin-top: 5px;">${JSON.stringify(data.data, null, 2)}</pre>
                </div>`;
            } else if (data.status === "NO_ACTION") {
                // AI'dan gelen ham Markdown metnini HTML formatına çeviriyoruz
                let formattedText = data.message
                    .replace(/\n/g, '<br>') // Satır atlamalarını düzeltir
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // **kalın** yazıları HTML'e çevirir
                    .replace(/\*(.*?)\*/g, '<em>$1</em>'); // *italik* yazıları HTML'e çevirir

                activeCanvasItem.innerHTML = `<div style="line-height: 1.6; color: #333;">${formattedText}</div>`;
            } else {
                // Risk motoru veya başka bir hata varsa
                activeCanvasItem.innerHTML = `<span style="color: #e53e3e;">🚨 Durum: ${data.message}</span>`;
            }
        } catch (error) {
            activeCanvasItem.innerHTML = `<span style="color: red;">❌ Sunucuya bağlanırken bir hata oluştu!</span>`;
        }
    });
}); 