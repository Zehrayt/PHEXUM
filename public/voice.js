// Ses Motoru
// GERÇEK SÖZLÜ SINAV MOTORU (Dinle & Konuş)

export function addAudioSupport(item, contentDiv, type) { 
    // 🔥 KRİTİK DÜZELTME 1: Tip undefined ise uygulamanın çökmesini engelle
    if (!type) return;

    // 🔥 KRİTİK DÜZELTME 2: Butonun kutu dışına uçmasını (görünmez olmasını) engellemek için
    // Ana kapsayıcıyı 'relative' yapıyoruz.
    item.style.position = "relative";
    
    // Eski bir ses butonu varsa onu sil (Çift buton çıkmasın)
    const existingBtn = item.querySelector('.audio-btn');
    if (existingBtn) existingBtn.remove();

    if (type === 'text' || type.startsWith('quiz')) {
        const playBtn = document.createElement('button');
        playBtn.className = 'audio-btn'; // Butona sınıf verdik
        
        const isQuiz = type.startsWith('quiz');
        playBtn.innerHTML = isQuiz ? '🔊 Sözlü Sınavı Başlat' : '🔊 Oku';
        playBtn.title = isQuiz ? 'Soruyu Dinle ve Sesli Cevapla' : 'Sesli Oku / Durdur';
        
        playBtn.style.cssText = "position: absolute; top: 5px; right: 35px; background: #ebf8ff; border: 1px solid #90cdf4; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px; font-weight: bold; color: #2b6cb0; z-index: 10; transition: 0.2s;";

        playBtn.onmouseover = () => playBtn.style.transform = "scale(1.05)";
        playBtn.onmouseout = () => playBtn.style.transform = "scale(1)";

        if (isQuiz) {
            contentDiv.style.filter = "blur(6px)";
            contentDiv.style.transition = "filter 0.4s ease";
            contentDiv.style.cursor = "help";
            contentDiv.title = "Soruyu dinlemek için Sözlü Sınav butonuna basın veya metni görmek için tıklayın.";

            // 🔥 KRİTİK DÜZELTME 3: Kullanıcı metne tıkladığında bluru kaldıran kod eklendi
            contentDiv.addEventListener('click', function unblur() {
                contentDiv.style.filter = "blur(0px)";
                contentDiv.title = ""; // İpucu yazısını temizle
            });
        }

        playBtn.onclick = (e) => {
            e.stopPropagation(); 

            if (!('speechSynthesis' in window)) return alert("Tarayıcınız sesli okumayı desteklemiyor.");

            if (speechSynthesis.speaking) {
                speechSynthesis.cancel();
                return;
            }

            // 1. Kutunun sanal bir kopyasını oluştur (orijinali bozulmasın diye)
            const tempDiv = contentDiv.cloneNode(true);

            // 2. Kopyanın içindeki gizli "Cevap (details)" bölümünü sil
            const detailsTag = tempDiv.querySelector('details');
            if (detailsTag) detailsTag.remove();

            // 3. Kopyanın içindeki butonları (Sözlü Sınav, Oku, Çarpı) sil
            const buttons = tempDiv.querySelectorAll('button, .audio-btn, .delete-btn');
            buttons.forEach(btn => btn.remove());

            // 4. Sadece tertemiz kalan soru ve şıkları al
            let textToRead = tempDiv.innerText.trim();
            const utterance = new SpeechSynthesisUtterance(textToRead);
            
            const englishPattern = /\b(the|is|and|are|in|on|at|of)\b/gi;
            if (englishPattern.test(textToRead)) {
                utterance.lang = 'en-US';
                utterance.rate = 1.0;     
            } else {
                utterance.lang = 'tr-TR'; 
                utterance.rate = 0.9;     
            }

            if (isQuiz) {
                utterance.onstart = () => {
                    playBtn.innerHTML = '🗣️ Soru Okunuyor...';
                    playBtn.style.background = '#bee3f8';
                };
                
                utterance.onend = () => {
                    if(typeof startVoiceExam === "function") startVoiceExam(playBtn, contentDiv);   
                };
            }

            speechSynthesis.speak(utterance);
        };
        item.appendChild(playBtn);
    }
}

// DİNLEME (Sesten Metne) MOTORU
function startVoiceExam(btn, contentDiv) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        btn.innerHTML = '🔊 Sözlü Sınavı Başlat';
        return alert("Tarayıcınız mikrofonla ses tanımayı desteklemiyor (Lütfen Chrome kullanın).");
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'tr-TR'; 
    recognition.interimResults = false;

    btn.innerHTML = '🎤 Dinliyor... Konuşun';
    btn.style.background = '#fed7d7';
    btn.style.color = '#c53030';
    btn.style.borderColor = '#fc8181';

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase().trim();
        
        // Öğrenci cevap verdiği an sorunun bluru tamamen kalkar
        contentDiv.style.filter = "blur(0px)";

        const inputField = contentDiv.querySelector('input[type="text"], textarea');
        if (inputField) {
            inputField.value = transcript; 
        } else {
            let answerDisplay = contentDiv.querySelector('.voice-answer-display');
            if (!answerDisplay) {
                answerDisplay = document.createElement('div');
                answerDisplay.className = 'voice-answer-display';
                contentDiv.appendChild(answerDisplay);
            }

            let isCorrect = false;
            let checkMessage = "Değerlendiriliyor...";
            let color = "#319795"; 
            let bgColor = "#e6fffa";

            const textContent = contentDiv.innerText.toLowerCase().replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ');
            
            const correctMatch = textContent.match(/cevap.*?([a-e])([\)\.\s]|$)/);

            if (correctMatch) {
                const correctAnswer = correctMatch[1]; 
                
                const firstWord = transcript.split(' ')[0].replace(/[\.\)]/g, ''); 

                if (
                    transcript === correctAnswer || 
                    firstWord === correctAnswer || 
                    transcript.includes(`${correctAnswer} şıkkı`) ||
                    transcript.includes(`${correctAnswer} seçeneği`)
                ) {
                    isCorrect = true;
                    checkMessage = "✅ Tebrikler, Doğru Bildiniz!";
                    color = "#2f855a"; 
                    bgColor = "#f0fff4";
                } else {
                    checkMessage = `❌ Yanlış Cevap. Doğrusu: ${correctAnswer.toUpperCase()} Şıkkı`;
                    color = "#c53030"; 
                    bgColor = "#fff5f5";
                }
            } else {
                checkMessage = "Sesiniz kaydedildi (Yapay zeka kutu içinde doğru şıkkı bulamadı)";
            }

            answerDisplay.style.cssText = `margin-top: 15px; padding: 10px; background: ${bgColor}; border-left: 4px solid ${color}; font-weight: bold; color: ${color}; border-radius: 4px; font-size: 14px;`;
            answerDisplay.innerHTML = `🎤 Sesiniz: <span style="font-weight: normal; font-style: italic;">"${event.results[0][0].transcript}"</span> <br> <span style="display:block; margin-top:5px;">${checkMessage}</span>`;
            
            const detailsTag = contentDiv.querySelector('details');
            if (detailsTag) detailsTag.open = true;
        }
    };

    recognition.onend = () => {
        btn.innerHTML = '🔊 Sözlü Sınavı Başlat';
        btn.style.background = '#ebf8ff';
        btn.style.color = '#2b6cb0';
        btn.style.borderColor = '#90cdf4';
        contentDiv.style.filter = "blur(0px)"; 
    };

    recognition.onerror = (event) => {
        console.error("Mikrofon Hatası:", event.error);
        alert("Sizi duyamadım veya mikrofon izni verilmedi.");
    };

    recognition.start();
}

export function initVoiceSummaryBlock(contentDiv) {
    contentDiv.innerHTML = `
        <div style="text-align: center; padding: 20px; background: #f7fafc; border-radius: 8px; border: 2px dashed #cbd5e0;">
            <h3 style="color: #2b6cb0; margin-top: 0;">🎙️ Neler Öğrendin?</h3>
            <p style="font-size: 14px; color: #4a5568;">Öğrendiklerini kendi cümlelerinle özetle, yapay zeka dinleyip sana puan versin!</p>
            <button class="start-summary-btn" style="margin-top: 15px; padding: 10px 20px; font-size: 14px; font-weight: bold; background: #3182ce; color: white; border: none; border-radius: 6px; cursor: pointer; transition: 0.2s;">
                🎤 Mikrofonu Aç ve Anlat
            </button>
            <div class="summary-result" style="margin-top: 20px; font-size: 14px; color: #2d3748; text-align: left; display: none;"></div>
        </div>
    `;

    const micBtn = contentDiv.querySelector('.start-summary-btn');
    const resultDiv = contentDiv.querySelector('.summary-result');

    micBtn.onclick = (e) => {
        e.stopPropagation();
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return alert("Tarayıcınız mikrofon desteklemiyor.");

        const recognition = new SpeechRecognition();
        recognition.lang = 'tr-TR';

        micBtn.innerHTML = '🎧 Dinliyorum... Konuşun';
        micBtn.style.background = '#e53e3e';

        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript;
            
            micBtn.innerHTML = '⏳ Yapay Zeka Analiz Ediyor...';
            micBtn.style.background = '#d69e2e'; 
            micBtn.disabled = true;

            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `<strong>🗣️ Söyledikleriniz:</strong> <i>"${transcript}"</i><br><br><span style="color: gray;">🤖 Analiz bekleniyor...</span>`;

            try {
                const pageContent = Array.from(document.querySelectorAll('.canvas-item'))
                .map(item => item.innerText)
                .join("\n\n");

            const shortContent = pageContent.slice(0, 1000);

            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: `
            Sayfa içeriği:
            ${shortContent}

            Öğrenci özeti:
            "${transcript}"

            Görev:
            Öğrencinin anlatımı sayfadaki içerikle ne kadar uyumlu?
            Eksikleri ve doğruları söyle.
            100 üzerinden puan ver.
            `,
                    blockType: "text"
                })
            });
                const data = await res.json();
                
                if(data.status === "SUCCESS" || data.status === "NO_ACTION") {
                    resultDiv.innerHTML = `
                        <strong>🗣️ Söyledikleriniz:</strong> <i>"${transcript}"</i><br><br>
                        <div style="padding: 10px; background: #f0fff4; border-left: 4px solid #38a169; border-radius: 4px;">
                            <strong>🤖 Yapay Zeka Değerlendirmesi:</strong><br>
                            ${data.content || data.message}
                        </div>
                    `;
                }
            } catch (err) {
                resultDiv.innerHTML += `<br><span style="color:red;">❌ Bağlantı hatası oluştu.</span>`;
            } finally {
                micBtn.innerHTML = '🎤 Yeniden Anlat';
                micBtn.style.background = '#3182ce';
                micBtn.disabled = false;
            }
        };

        recognition.start();
    };
}