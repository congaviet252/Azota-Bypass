// ==UserScript==
// @name         AZOTA HUYNH DUONG DEV AUTO ĐÁP ÁN
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  [ CODE CHO NGƯỜI LƯỜI MUỐN THỂ HIỆN ] Bảng điều khiển có thể kéo, Bộ nhớ ngữ cảnh (Thử nghiệm), Tự động trả lời Azota với "Huỳnh Dương V1" (Song Tử).
// @match        https://azota.vn/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @connect      generativelanguage.googleapis.com
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration ---
    const SCRIPT_VERSION = '2.0';
    const HELPER_NAME = "Huỳnh Dương"; // Personalized name
    const DISPLAY_MODEL_NAME = "Huynh Duong V1"; // Display name for the "model"

    const GEMINI_API_KEY_STORAGE = 'huynhDuongApiKey_v2_2'; // Unique storage key
    const PANEL_POS_STORAGE = 'huynhDuongPanelPos_v2_2';
    const LOG_PANEL_POS_STORAGE = 'huynhDuongLogPanelPos_v2_2';
    const PANEL_COLLAPSED_STORAGE = 'huynhDuongPanelCollapsed_v2_2';
    const LOG_VISIBLE_STORAGE = 'huynhDuongLogVisible_v2_2';

    const GEMINI_MODEL = 'gemini-2.0-flash'; // ACTUAL model used for API calls
    const AZOTA_LOGO_URL = 'https://cdn.jsdelivr.net/gh/azota889/storage_public/azota_assets/images/og_image.png';

    const SYSTEM_INSTRUCTION = `You are ${HELPER_NAME}, a highly precise assistant (${DISPLAY_MODEL_NAME}). Your task is to answer educational questions based *strictly and solely* on the provided context (instructions, previous Q&A history if provided, current question text, options). Do not use any external knowledge or make assumptions beyond the given text.
    - For Multiple Choice Questions (MCQ): Analyze the question and options. Respond with ONLY the single capital letter (A, B, C, or D) corresponding to the most accurate answer based on the text. No explanations or extra characters.
    - For Essay/Fill-in Questions: Generate ONLY the text required to answer the question or complete the task as requested, considering the provided history for context if available. Do not add introductory phrases. Be concise and directly address the prompt.
    Adhere strictly to the requested output format. Accuracy and adherence to the provided text and history are paramount.`;

    const REQUEST_DELAY = 2500; // Keep delay high
    const ANSWER_DELAY = 800;
    const MAX_LOG_ENTRIES = 150;
    const MAX_HISTORY_ENTRIES = 5; // Max previous Q/A pairs to remember for essays

    // --- Styles ---
    // (Keep the CSS from v2.1, no major style changes needed for this version)
    GM_addStyle(`
        /* CSS Variables */
        :root { /* Same variables as v2.1 */
            --ai-panel-bg: #ffffff; --ai-panel-border: #ced4da; --ai-panel-shadow: rgba(0, 0, 0, 0.12);
            --ai-header-bg: #f8f9fa; --ai-header-text: #004085; --ai-button-text: #ffffff;
            --ai-button-primary-bg: #007bff; --ai-button-primary-hover: #0056b3;
            --ai-button-success-bg: #28a745; --ai-button-success-hover: #1e7e34;
            --ai-button-danger-bg: #dc3545; --ai-button-danger-hover: #b02a37;
            --ai-button-info-bg: #17a2b8; --ai-button-info-hover: #107586;
            --ai-button-secondary-bg: #6c757d; --ai-button-secondary-hover: #545b62;
            --ai-status-text: #495057; --ai-status-error: #a94442; --ai-log-bg: #f1f3f5;
            --ai-log-border: #adb5bd; --ai-log-text: #343a40; --ai-processing-border: #ffc107;
            --ai-processing-bg: #fff8e1; --ai-answered-border: #28a745; --ai-answered-bg: #e9f7ef;
            --ai-error-border: #dc3545; --ai-error-bg: #f8d7da; --ai-selected-mcq-border: #17a2b8;
            --ai-selected-mcq-bg: #e0f7fa;
        }
        /* Main Helper Panel Container */
        #ai-helper-panel-container { position: fixed; z-index: 10000; width: 290px; }
        #ai-helper-panel { background-color: var(--ai-panel-bg); border: 1px solid var(--ai-panel-border); border-radius: 6px; box-shadow: 0 5px 15px var(--ai-panel-shadow); font-family: 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; font-size: 14px; overflow: hidden; transition: box-shadow 0.3s; display: flex; flex-direction: column; }
        /* Panel Header (Draggable Area) */
        #ai-panel-header { background-color: var(--ai-header-bg); padding: 10px 15px; cursor: grab; border-bottom: 1px solid var(--ai-panel-border); display: flex; align-items: center; justify-content: space-between; user-select: none; }
        #ai-panel-header:active { cursor: grabbing; }
        #ai-panel-header h3 { margin: 0; font-size: 15px; font-weight: 600; color: var(--ai-header-text); display: flex; align-items: center; gap: 8px; }
        #ai-panel-header h3 img { height: 18px; width: auto; vertical-align: middle; }
        #ai-panel-toggle-icon { font-size: 18px; transition: transform 0.3s ease-in-out; cursor: pointer; padding: 0 5px; }
        #ai-helper-panel.collapsed #ai-panel-toggle-icon { transform: rotate(-90deg); }
        /* Panel Content */
        #ai-panel-content { padding: 15px; overflow-y: auto; transition: max-height 0.35s ease-out, padding 0.35s ease-out, opacity 0.3s ease-out; max-height: 60vh; opacity: 1; border-top: none; }
        #ai-helper-panel.collapsed #ai-panel-content { max-height: 0; padding-top: 0; padding-bottom: 0; opacity: 0; overflow: hidden; }
        #ai-panel-content .button-group { margin-bottom: 15px; }
        #ai-panel-content button { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 9px 12px; margin-bottom: 8px; border: none; border-radius: 5px; cursor: pointer; font-size: 13.5px; font-weight: 500; transition: background-color 0.2s, transform 0.1s; color: var(--ai-button-text); }
        #ai-panel-content button:hover:not(:disabled) { opacity: 0.88; }
        #ai-panel-content button:active:not(:disabled) { transform: scale(0.97); }
        #ai-panel-content button:disabled { background-color: #adb5bd; cursor: not-allowed; opacity: 0.7; }
         /* Specific Button Styles */
         #start-ai-btn { background-color: var(--ai-button-success-bg); } #start-ai-btn:hover:not(:disabled) { background-color: var(--ai-button-success-hover); }
         #stop-ai-btn { background-color: var(--ai-button-danger-bg); } #stop-ai-btn:hover:not(:disabled) { background-color: var(--ai-button-danger-hover); }
         #show-answer-btn { background-color: var(--ai-button-info-bg); } #show-answer-btn:hover:not(:disabled) { background-color: var(--ai-button-info-hover); }
         #set-api-key-btn { background-color: var(--ai-button-primary-bg); } #set-api-key-btn:hover:not(:disabled) { background-color: var(--ai-button-primary-hover); }
         #toggle-log-btn { background-color: var(--ai-button-secondary-bg); } #toggle-log-btn:hover:not(:disabled) { background-color: var(--ai-button-secondary-hover); }
         /* Status Area */
        #ai-status { margin-top: 15px; padding-top: 10px; border-top: 1px solid var(--ai-panel-border); font-style: italic; color: var(--ai-status-text); text-align: center; min-height: 2em; font-size: 12.5px; line-height: 1.4; word-wrap: break-word; }
        /* Log Panel */
        #ai-log-panel { position: fixed; z-index: 9999; width: 480px; max-height: 50vh; background-color: var(--ai-log-bg); border: 1px solid var(--ai-log-border); border-radius: 6px; box-shadow: 0 5px 15px var(--ai-panel-shadow); font-family: 'Consolas', 'Menlo', 'Courier New', monospace; font-size: 11.5px; display: none; flex-direction: column; }
        #ai-log-panel.visible { display: flex; }
        #ai-log-header { padding: 8px 12px; border-bottom: 1px solid var(--ai-log-border); font-weight: bold; background-color: var(--ai-header-bg); display: flex; justify-content: space-between; align-items: center; cursor: grab; user-select: none; }
        #ai-log-header:active { cursor: grabbing; }
        #ai-log-content { padding: 10px; overflow-y: auto; flex-grow: 1; color: var(--ai-log-text); line-height: 1.4; }
        #ai-log-content div { border-bottom: 1px dashed #ccc; padding: 3px 0; margin-bottom: 3px; word-break: break-word; }
        #ai-log-content div:last-child { border-bottom: none; }
        #ai-log-content .log-timestamp { color: #6c757d; margin-right: 5px; }
        #ai-log-content .log-prompt b { color: #0056b3; } #ai-log-content .log-response b { color: #1e7e34; }
        #ai-log-content .log-action b { color: #6f42c1; } #ai-log-content .log-info b { color: #107586; }
        #ai-log-content .log-warn b { color: #ffc107; } #ai-log-content .log-error b { color: var(--ai-status-error); }
        #clear-log-btn { padding: 3px 8px; font-size: 11px; background-color: var(--ai-button-secondary-bg); color: white; border: none; border-radius: 4px; cursor: pointer; }
        #clear-log-btn:hover { background-color: var(--ai-button-secondary-hover); }
        /* Question Highlighting */
        .azt-question.processing-ai { outline: 2px dashed var(--ai-processing-border) !important; outline-offset: 2px; background-color: var(--ai-processing-bg) !important; }
        .azt-question.answered-ai { border-left: 4px solid var(--ai-answered-border) !important; background-color: var(--ai-answered-bg) !important; }
        .azt-question.error-ai { border-left: 4px solid var(--ai-error-border) !important; background-color: var(--ai-error-bg) !important; }
        /* Selected MCQ Answer */
        .item-answer.selected-by-ai { border: 1px solid var(--ai-selected-mcq-border) !important; border-left-width: 4px !important; padding: 5px 5px 5px 8px; margin: 2px -7px 2px -7px; border-radius: 4px; background-color: var(--ai-selected-mcq-bg) !important; transition: background-color 0.3s; }
        .item-answer.selected-by-ai button.btn { background-color: var(--ai-button-info-bg) !important; border-color: var(--ai-button-info-hover) !important; color: white !important; font-weight: 500; }
        /* Filled Essay */
        textarea.filled-by-ai { background-color: var(--ai-selected-mcq-bg) !important; border: 1px solid var(--ai-selected-mcq-border) !important; box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1); }
        /* Show Answer Highlight */
        .highlight-answer-temp { box-shadow: 0 0 0 3px var(--ai-button-info-bg); transition: box-shadow 0.5s ease-in-out; border-radius: 4px; }
        /* SweetAlert Customizations */
        .swal2-popup { font-size: 0.9rem !important; } .swal2-title { font-size: 1.25rem !important; }
        .swal2-html-container { font-size: 0.9rem !important; text-align: left !important; }
        .swal2-warning { border-color: #facea8 !important; }
    `);

    // --- Global State ---
    let apiKey = GM_getValue(GEMINI_API_KEY_STORAGE, '');
    let stopProcessing = false;
    let isPanelCollapsed = GM_getValue(PANEL_COLLAPSED_STORAGE, false);
    let isLogVisible = GM_getValue(LOG_VISIBLE_STORAGE, false);
    let logEntries = [];
    let conversationHistory = []; // Stores { qLabel: string, question: string, answer: string }

    // --- UI Elements ---
    const panelContainer = document.createElement('div');
    panelContainer.id = 'ai-helper-panel-container';
    panelContainer.style.bottom = '10px'; panelContainer.style.left = '10px'; // Default

    const panel = document.createElement('div');
    panel.id = 'ai-helper-panel';
    panel.innerHTML = `
        <div id="ai-panel-header">
            <h3>
                <a href="https://azota.vn/" target="_blank" title="Go to Azota.vn">
                    <img src="${AZOTA_LOGO_URL}" alt="Azota Logo">
                </a>
                ${HELPER_NAME} Helper ${SCRIPT_VERSION}
            </h3>
            <span id="ai-panel-toggle-icon" title="Thu gọn/Mở rộng">▼</span>
        </div>
        <div id="ai-panel-content">
             <div class="button-group">
                <button id="start-ai-btn" title="Bắt đầu tự động trả lời tất cả câu hỏi (Rủi ro cao)">🚀 Bắt đầu Auto (${HELPER_NAME})</button>
                <button id="stop-ai-btn" title="Dừng quá trình tự động trả lời">🛑 Dừng Auto</button>
            </div>
            <div class="button-group">
                <button id="show-answer-btn" title="Xem gợi ý đáp án cho câu hỏi đang hiển thị">💡 ${HELPER_NAME} gợi ý</button>
                <button id="toggle-log-btn" title="Hiện/Ẩn bảng ghi log chi tiết">📄 ${isLogVisible ? 'Ẩn Log' : 'Hiện Log'}</button>
                <button id="set-api-key-btn" title="Nhập hoặc thay đổi Gemini API Key">🔑 API Key</button>
            </div>
            <div id="ai-status">Đang khởi tạo...</div>
        </div>
    `;
    panelContainer.appendChild(panel);
    document.body.appendChild(panelContainer);

    const logPanel = document.createElement('div');
    logPanel.id = 'ai-log-panel';
    logPanel.innerHTML = `
        <div id="ai-log-header">
            <span>📝 ${HELPER_NAME} Log</span>
            <button id="clear-log-btn" title="Xóa nội dung log">Xóa Log</button>
        </div>
        <div id="ai-log-content"></div>
    `;
    logPanel.style.bottom = '10px'; logPanel.style.left = '310px'; // Default
    document.body.appendChild(logPanel);

    // Get references
    const startButton = document.getElementById('start-ai-btn');
    const stopButton = document.getElementById('stop-ai-btn');
    const showAnswerButton = document.getElementById('show-answer-btn');
    const setApiKeyButton = document.getElementById('set-api-key-btn');
    const toggleLogButton = document.getElementById('toggle-log-btn');
    const clearLogButton = document.getElementById('clear-log-btn');
    const statusDiv = document.getElementById('ai-status');
    const panelHeader = document.getElementById('ai-panel-header');
    const logHeader = document.getElementById('ai-log-header');
    const logContentDiv = document.getElementById('ai-log-content');
    const panelToggleIcon = document.getElementById('ai-panel-toggle-icon');

    // --- Draggable Logic (from v2.1) ---
    function makeDraggable(panelElement, headerElement, storageKey) {
        let isDragging = false; let startX, startY, initialLeft, initialTop;
        const savedPos = GM_getValue(storageKey);
        if (savedPos && savedPos.left && savedPos.top) { panelElement.style.left = savedPos.left; panelElement.style.top = savedPos.top; panelElement.style.bottom = 'auto'; panelElement.style.right = 'auto'; }
        headerElement.addEventListener('mousedown', (e) => { if (e.target !== headerElement && !e.target.closest(`#${headerElement.id} > *:not(#ai-panel-toggle-icon)`) && e.target !== panelToggleIcon) return; isDragging = true; startX = e.clientX; startY = e.clientY; const rect = panelElement.getBoundingClientRect(); initialLeft = rect.left; initialTop = rect.top; panelElement.style.cursor = 'grabbing'; headerElement.style.cursor = 'grabbing'; document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); e.preventDefault(); });
        function onMouseMove(e) { if (!isDragging) return; const dx = e.clientX - startX; const dy = e.clientY - startY; const newLeft = initialLeft + dx; const newTop = initialTop + dy; panelElement.style.left = `${newLeft}px`; panelElement.style.top = `${newTop}px`; panelElement.style.bottom = 'auto'; panelElement.style.right = 'auto'; }
        function onMouseUp() { if (isDragging) { isDragging = false; panelElement.style.cursor = 'default'; headerElement.style.cursor = 'grab'; document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); GM_setValue(storageKey, { left: panelElement.style.left, top: panelElement.style.top }); addLogEntry('info', `Panel ${panelElement.id.split('-')[1]} moved`); } }
    }

    // --- Helper Functions ---

    function updateStatus(message, isError = false) { /* Same as v2.1 */
         console.log(`[${HELPER_NAME} Status] ${message}`); statusDiv.textContent = message; statusDiv.style.color = isError ? 'var(--ai-status-error)' : 'var(--ai-status-text)';
    }
    function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    function addLogEntry(type, message) { /* Same as v2.1 */
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        logEntries.push({ timestamp, type, message }); if (logEntries.length > MAX_LOG_ENTRIES) logEntries.shift();
        if (isLogVisible) renderLogPanel();
    }
    function renderLogPanel() { /* Same as v2.1 */
         logContentDiv.innerHTML = ''; logEntries.forEach(entry => { const logDiv = document.createElement('div'); logDiv.classList.add(`log-${entry.type}`); const safeMessage = entry.message.replace(/</g, "<").replace(/>/g, ">").replace(/\n/g, "<br>"); logDiv.innerHTML = `<span class="log-timestamp">[${entry.timestamp}]</span> <b>[${entry.type.toUpperCase()}]:</b> ${safeMessage}`; logContentDiv.appendChild(logDiv); }); logContentDiv.scrollTop = logContentDiv.scrollHeight;
    }
    function toggleLogPanel() { /* Same as v2.1 */
        isLogVisible = !isLogVisible; logPanel.classList.toggle('visible', isLogVisible); toggleLogButton.textContent = isLogVisible ? '📄 Ẩn Log' : '📄 Hiện Log'; GM_setValue(LOG_VISIBLE_STORAGE, isLogVisible);
        if (isLogVisible) renderLogPanel(); addLogEntry('action', isLogVisible ? 'Log panel opened' : 'Log panel closed');
    }
    function clearLog() { /* Same as v2.1 */ logEntries = []; renderLogPanel(); addLogEntry('action', 'Log cleared by user'); }
    function togglePanelCollapse(e) { /* Same as v2.1 */
         if (e && e.target !== panelToggleIcon) return; isPanelCollapsed = !isPanelCollapsed; panel.classList.toggle('collapsed', isPanelCollapsed); GM_setValue(PANEL_COLLAPSED_STORAGE, isPanelCollapsed); addLogEntry('action', isPanelCollapsed ? 'Main panel collapsed' : 'Main panel expanded'); panelToggleIcon.textContent = isPanelCollapsed ? '▶' : '▼';
    }
    async function promptApiKey() { /* Same as v2.1 */
         Swal.fire({ title: 'Nhập Gemini API Key', input: 'text', inputValue: GM_getValue(GEMINI_API_KEY_STORAGE, ''), inputPlaceholder: 'Dán API Key của bạn (vd: AIza...)', inputAttributes: { autocapitalize: 'off', autocorrect: 'off' }, showCancelButton: true, confirmButtonText: '💾 Lưu Key', cancelButtonText: 'Hủy', confirmButtonColor: 'var(--ai-button-primary-bg)', inputValidator: (value) => { if (!value || !value.trim()) return 'API Key không được để trống!'; if (!value.startsWith('AIza') || value.length < 30) return 'API Key có vẻ không hợp lệ.'; return null; }
        }).then((result) => { if (result.isConfirmed && result.value) { apiKey = result.value.trim(); GM_setValue(GEMINI_API_KEY_STORAGE, apiKey); updateStatus(`Đã lưu API Key. ${DISPLAY_MODEL_NAME} sẵn sàng!`); Swal.fire('Thành công!', 'Đã lưu API Key.', 'success'); addLogEntry('action', 'API Key updated.'); } });
    }

    // --- Context Memory Functions ---
     function addConversationHistory(questionData, answerText) {
         if (!questionData || !answerText || !questionData.fullText) return; // Need question text
         conversationHistory.push({
             qLabel: questionData.questionLabel || `EssayQ`, // Keep label/placeholder
             question: questionData.fullText, // Store full context
             answer: answerText
         });
         if (conversationHistory.length > MAX_HISTORY_ENTRIES) {
             conversationHistory.shift(); // Remove the oldest entry
         }
         addLogEntry('info', `Added Q: ${questionData.questionLabel || '?'} to history (${conversationHistory.length}/${MAX_HISTORY_ENTRIES})`);
     }

     function buildPromptWithHistory(basePrompt, qType) {
         if (qType !== 'essay' || conversationHistory.length === 0) {
             return basePrompt; // Only add history context for essay questions
         }

         let historyString = "Relevant previous essay Q&A history (Use this for context if applicable):\n====== HISTORY START ======\n";
         conversationHistory.forEach((entry, index) => {
             // Keep history context relatively concise in the prompt
             const qSnippet = entry.question.substring(0, 250) + (entry.question.length > 250 ? '...' : '');
             const aSnippet = entry.answer.substring(0, 350) + (entry.answer.length > 350 ? '...' : '');
             historyString += `--- [History Entry ${index + 1} - ${entry.qLabel || 'Prev'}] ---\n`;
             historyString += `Question Context: ${qSnippet}\n`;
             historyString += `Your Previous Answer: ${aSnippet}\n\n`;
         });
         historyString += "====== HISTORY END ======\n\n--- Current Task ---\n";

         // Prepend history to the base prompt
         return historyString + basePrompt;
     }


    // --- Core Logic Functions (API Call, Processing) ---

    function callGeminiAPI(promptText, isShowAnswer = false) { // Now includes SYSTEM_INSTRUCTION
        return new Promise((resolve, reject) => {
            if (!apiKey) { /* ... Key check ... */ const msg = "Lỗi API: Chưa có API Key!"; updateStatus(msg, true); addLogEntry('error', msg); reject("API Key is missing."); return; }
            const statusMsg = isShowAnswer ? `Đang lấy gợi ý từ ${HELPER_NAME}...` : `Đang gọi ${HELPER_NAME} trả lời...`;
            updateStatus(statusMsg);
            addLogEntry('prompt', `(${GEMINI_MODEL}) Requesting: ${promptText.substring(0, 200)}...`);

            const contents = [];
            if (SYSTEM_INSTRUCTION) { // Add system instruction if defined
                contents.push({ "role": "user", "parts": [{"text": SYSTEM_INSTRUCTION}] });
                contents.push({ "role": "model", "parts": [{"text": `Okay, I am ${HELPER_NAME} (${DISPLAY_MODEL_NAME}) and I will follow the instructions precisely.`}] }); // Acknowledge persona
            }
            contents.push({ "role": "user", "parts": [{"text": promptText}] });

            GM_xmlhttpRequest({ /* ... Rest of GM_xmlhttpRequest call same as v2.1 ... */
                method: "POST", url: `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, headers: { "Content-Type": "application/json" }, timeout: 60000,
                data: JSON.stringify({ "contents": contents, "generationConfig": { "temperature": isShowAnswer ? 0.55 : 0.3, "topK": 1, "topP": 0.95, "maxOutputTokens": 3072, "stopSequences": [] },
                "safetySettings": [ {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}, {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}, {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}, {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"} ] }),
                onload: function(response) { let aiText = null; let errorReason = null;
                    if (response.status >= 200 && response.status < 300) { try { const result = JSON.parse(response.responseText); if (result?.candidates?.[0]?.content?.parts?.[0]?.text) { aiText = result.candidates[0].content.parts[0].text.trim(); addLogEntry('response', `${HELPER_NAME} Raw: ${aiText.substring(0, 500)}${aiText.length > 500 ? '...' : ''}`); resolve(aiText); } else if (result?.promptFeedback?.blockReason) { errorReason = `${HELPER_NAME} API Blocked: ${result.promptFeedback.blockReason}`; addLogEntry('error', `${HELPER_NAME} API Request Blocked: ${result.promptFeedback.blockReason} - Safety: ${JSON.stringify(result.promptFeedback.safetyRatings)}`); } else if (result?.candidates?.[0]?.finishReason && result.candidates[0].finishReason !== "STOP") { errorReason = `${HELPER_NAME} API finished unexpectedly: ${result.candidates[0].finishReason}`; addLogEntry('error', `${HELPER_NAME} API Finish Reason: ${result.candidates[0].finishReason} - Safety: ${JSON.stringify(result.candidates[0].safetyRatings)}`); } else { errorReason = `Unexpected response structure from ${HELPER_NAME}.`; addLogEntry('error', `Unexpected API structure: ${response.responseText.substring(0, 500)}`); } } catch (e) { errorReason = `Failed to parse ${HELPER_NAME} response.`; addLogEntry('error', `Failed to parse API response: ${e} - Response: ${response.responseText.substring(0, 500)}`); } } else { errorReason = `${HELPER_NAME} API request failed: ${response.status} ${response.statusText}`; let errorDetail = response.responseText; try { const errorJson = JSON.parse(response.responseText); if (errorJson?.error?.message) errorDetail = errorJson.error.message; } catch {} addLogEntry('error', `API request failed: ${response.status} ${response.statusText} - Detail: ${errorDetail.substring(0,500)}`); }
                    if (aiText === null) { updateStatus(errorReason || `Lỗi không xác định từ ${HELPER_NAME}`, true); reject(errorReason || `Unknown error from ${HELPER_NAME}`); } },
                onerror: function(error) { const msg = `Lỗi mạng khi gọi ${HELPER_NAME}: ${error.statusText || 'Network error'}`; updateStatus(msg, true); addLogEntry('error', msg); reject(msg); },
                ontimeout: function() { const msg = `Lỗi API ${HELPER_NAME}: Hết thời gian chờ (60s).`; updateStatus(msg, true); addLogEntry('error', msg); reject(msg); }
            });
        });
    }

    function extractQuestionData(questionElement) { /* Same as v2.1 */
        const questionData = { id: questionElement.id, element: questionElement, fullText: '', questionText: '', options: {}, type: 'unknown', groupInstruction: '', questionLabel: '', textarea: null };
        try { /* ... extraction logic ... */
            let instructionEl = questionElement.querySelector(':scope > div > .question-standalone-container > .group-content-of-question-standalone azt-dynamic-hook'); if (!instructionEl || instructionEl.innerText.trim() === '') instructionEl = questionElement.querySelector(':scope > div > .question-standalone-container > .group-content-of-question-standalone');
            if (instructionEl && instructionEl.innerText.trim() !== '') { const mainContentTest = questionElement.querySelector(':scope > div > .question-standalone-container > .question-standalone-main-content .question-standalone-content-box azt-dynamic-hook'); if (!mainContentTest || mainContentTest.innerText.trim() === '') questionData.groupInstruction = instructionEl.innerText.trim(); }
            const labelElement = questionElement.querySelector('.question-standalone-label'); if (labelElement) questionData.questionLabel = labelElement.innerText.trim();
            const contentElement = questionElement.querySelector('.question-standalone-main-content .question-standalone-content-box azt-dynamic-hook'); let contentText = ''; if (contentElement) contentText = contentElement.innerText.trim(); if (contentText && (!questionData.groupInstruction || !contentText.includes(questionData.groupInstruction))) questionData.questionText = contentText;
            let fullTextParts = []; if (questionData.groupInstruction) fullTextParts.push("Hướng dẫn: " + questionData.groupInstruction); if (questionData.questionLabel) fullTextParts.push(questionData.questionLabel + (questionData.questionText ? ":" : "")); if (questionData.questionText) fullTextParts.push(questionData.questionText); questionData.fullText = fullTextParts.join("\n\n");
            const answerItems = questionElement.querySelectorAll('.item-answer');
            if (answerItems.length > 0) { questionData.type = 'mcq'; answerItems.forEach(item => { const button = item.querySelector('button.btn'); const answerContent = item.querySelector('.answer-content azt-dynamic-hook'); if (button && answerContent) { const label = button.innerText.trim().toUpperCase(); const text = answerContent.innerText.trim(); if (label && text && /^[A-D]$/.test(label)) questionData.options[label] = { text: text, button: button, container: item }; else addLogEntry('warn', `Invalid MCQ option: L='${label}', T='${text.substring(0,20)}...' in ${questionData.id}`); } else addLogEntry('warn', `MCQ option structure error in ${questionData.id}`); }); if (Object.keys(questionData.options).length === 0) { questionData.type = 'unknown'; addLogEntry('error', `MCQ options empty for ${questionData.id}`); }
            } else { const textarea = questionElement.querySelector('textarea.form-control'); if (textarea) { questionData.type = 'essay'; questionData.textarea = textarea; } }
            if(questionData.type === 'unknown' && questionData.groupInstruction && !questionData.questionText) questionData.type = 'instruction_only';
            if (questionData.type === 'unknown' && !questionData.groupInstruction && !questionData.questionText && Object.keys(questionData.options).length === 0 && !questionData.textarea) addLogEntry('info', `Element ${questionData.id || 'N/A'} empty/unparseable.`);
        } catch (error) { console.error(`Err extracting ${questionElement.id}:`, error); addLogEntry('error', `Critical extract error ${questionElement.id}: ${error.message}`); questionData.type = 'unknown'; }
        return questionData;
     }

    async function processMCQ(questionData, questionElement) { /* Same logic as v2.1, just uses HELPER_NAME in logs/status */
        const qLabel = questionData.questionLabel || questionData.id;
        let prompt = `Context:\n${questionData.groupInstruction || 'None'}\n\nQuestion (${qLabel}):\n${questionData.questionText}\n\nOptions:\n`;
        let optionsString = ""; Object.entries(questionData.options).forEach(([label, data]) => { optionsString += `${label}. ${data.text}\n`; }); prompt += optionsString;
        prompt += "\nChoose the best option (A, B, C, or D). Respond with ONLY the single capital letter.";
        try {
            const aiAnswerRaw = await callGeminiAPI(prompt); updateStatus(`${HELPER_NAME} raw (${qLabel}): ${aiAnswerRaw.substring(0, 20)}`);
            const match = aiAnswerRaw.match(/^\s*([A-D])\b/i);
            if (match?.[1]) { const cleanAnswerLetter = match[1].toUpperCase(); addLogEntry('action', `${HELPER_NAME} chose '${cleanAnswerLetter}' for ${qLabel}. Raw: '${aiAnswerRaw.substring(0,50)}'`); updateStatus(`${HELPER_NAME} suggested '${cleanAnswerLetter}'. Clicking...`);
                if (questionData.options[cleanAnswerLetter]) { await sleep(ANSWER_DELAY); const targetButton = questionData.options[cleanAnswerLetter].button; const targetContainer = questionData.options[cleanAnswerLetter].container; Object.values(questionData.options).forEach(optData => { optData.container.classList.remove('selected-by-ai'); optData.button.classList.remove('selected-by-ai', 'btn-primary'); optData.button.classList.add('btn-outline-secondary', 'border-slate-400'); }); targetButton.click(); addLogEntry('action', `Clicked button '${cleanAnswerLetter}' for ${qLabel}`); await sleep(150); targetContainer.classList.add('selected-by-ai'); targetButton.classList.add('selected-by-ai'); updateStatus(`Clicked '${cleanAnswerLetter}' for ${qLabel}.`); questionElement.classList.add('answered-ai');
                } else { const msg = `Internal Error: ${HELPER_NAME} returned '${cleanAnswerLetter}', but option missing for ${qLabel}.`; updateStatus(msg, true); addLogEntry('error', msg); questionElement.classList.add('error-ai'); }
            } else { const msg = `${HELPER_NAME} Error: Invalid format '${aiAnswerRaw.substring(0,10)}...' for ${qLabel}.`; updateStatus(msg, true); addLogEntry('error', `${HELPER_NAME} invalid format: '${aiAnswerRaw}' for ${qLabel}. Opts:\n${optionsString}`); questionElement.classList.add('error-ai'); }
        } catch (error) { const errorMsg = `Error processing MCQ ${qLabel}: ${error}`; console.error(errorMsg); if (!statusDiv.textContent.includes("API")) updateStatus(errorMsg, true); addLogEntry('error', errorMsg); questionElement.classList.add('error-ai'); }
    }

    async function processEssay(questionData, questionElement) { // MODIFIED to add history
        const qLabel = questionData.questionLabel || questionData.id;
        // Build the base prompt first
        let basePrompt = `Context:\n${questionData.groupInstruction || 'None'}\n\nQuestion/Task (${qLabel}):\n${questionData.questionText}\n\nProvide ONLY the text response.`;
        // Add history context
        let fullPrompt = buildPromptWithHistory(basePrompt, 'essay');

        try {
            const aiAnswerText = await callGeminiAPI(fullPrompt);
            updateStatus(`${HELPER_NAME} response received for essay ${qLabel}`);
            addLogEntry('action', `Essay answer received for ${qLabel}`);

            await sleep(ANSWER_DELAY);
            const textarea = questionData.textarea;
            if (textarea) {
                textarea.value = aiAnswerText; textarea.classList.add('filled-by-ai');
                const inputEvent = new Event('input', { bubbles: true, cancelable: true }); const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                textarea.dispatchEvent(inputEvent); textarea.dispatchEvent(changeEvent);
                updateStatus(`Filled essay answer for ${qLabel}`); addLogEntry('action', `Filled textarea for ${qLabel}`); questionElement.classList.add('answered-ai');

                // *** Add to conversation history AFTER successful processing ***
                addConversationHistory(questionData, aiAnswerText);

            } else { /* ... error handling ... */ const msg = `Internal Error: Textarea element missing for essay ${qLabel}.`; updateStatus(msg, true); addLogEntry('error', msg); questionElement.classList.add('error-ai'); }
        } catch (error) { /* ... error handling ... */ const errorMsg = `Error processing Essay ${qLabel}: ${error}`; console.error(errorMsg); if (!statusDiv.textContent.includes("API")) updateStatus(errorMsg, true); addLogEntry('error', errorMsg); questionElement.classList.add('error-ai'); }
    }

    function findMostVisibleQuestion() { /* Same as v2.1 */
         const questions = document.querySelectorAll('.azt-question.box'); let mostVisible = null; let maxVisibleRatio = 0; const vpHeight = window.innerHeight; questions.forEach(q => { const r = q.getBoundingClientRect(); const vh = Math.max(0, Math.min(r.bottom, vpHeight) - Math.max(r.top, 0)); const vr = r.height > 0 ? vh / r.height : 0; if (vr > maxVisibleRatio) { maxVisibleRatio = vr; mostVisible = q; } }); return mostVisible;
    }

    async function showSingleAnswer() { // MODIFIED to potentially include history for essays
        if (!apiKey) { /* ... API Key check ... */ updateStatus('Lỗi: Chưa nhập API Key!', true); Swal.fire('Lỗi', 'Vui lòng nhập Gemini API Key trước.', 'error'); await promptApiKey(); if(!apiKey) return; }
        const questionElement = findMostVisibleQuestion();
        if (!questionElement) { /* ... Not found handling ... */ updateStatus("Không tìm thấy câu hỏi nào trên màn hình.", true); Swal.fire('Không tìm thấy', 'Không có câu hỏi nào đang hiển thị rõ ràng.', 'warning'); return; }
        document.querySelectorAll('.highlight-answer-temp').forEach(el => el.classList.remove('highlight-answer-temp'));
        const qIdForLog = questionElement.id || 'visible_q';
        updateStatus(`Đang lấy gợi ý từ ${HELPER_NAME} cho ${qIdForLog}...`); addLogEntry('action', `Requesting hint from ${HELPER_NAME} for ${qIdForLog}`);
        questionElement.classList.add('processing-ai');

        const questionData = extractQuestionData(questionElement); const qLabel = questionData.questionLabel || qIdForLog;

        if (questionData.type === 'instruction_only' || questionData.type === 'unknown') { /* ... Skip handling ... */
            updateStatus(`Không thể lấy gợi ý cho khối này (${qLabel}).`); questionElement.classList.remove('processing-ai'); Swal.fire('Không áp dụng', 'Không thể lấy gợi ý cho loại nội dung này.', 'info'); addLogEntry('info', `Hint not applicable for ${qLabel} (type: ${questionData.type})`); return;
        }

        let basePrompt = `You are ${HELPER_NAME}, an assistant providing hints based ONLY on the text.\nContext:\n${questionData.groupInstruction || 'None'}\nQuestion (${qLabel}):\n${questionData.questionText}\n`;
        let optionsString = ""; let fullPrompt = "";

        if (questionData.type === 'mcq') {
            basePrompt += `Options:\n`; Object.entries(questionData.options).forEach(([label, data]) => { optionsString += `${label}. ${data.text}\n`; }); basePrompt += optionsString;
            basePrompt += `\nWhat is the most likely correct option (A, B, C, or D) and provide a very brief, one-sentence justification based strictly on the text? Respond ONLY in the format: ANSWER: [Letter], REASON: [Brief one-sentence reason]`;
            fullPrompt = basePrompt; // No history for MCQ hints
        } else if (questionData.type === 'essay') {
            basePrompt += `\nProvide the likely correct answer text based strictly on the question and history. Respond ONLY with the answer text itself.`;
            fullPrompt = buildPromptWithHistory(basePrompt, 'essay'); // Add history for essay hints
        }

        try {
            const aiAnswerRaw = await callGeminiAPI(fullPrompt, true);
            addLogEntry('response', `${HELPER_NAME} Hint raw for ${qLabel}: ${aiAnswerRaw.substring(0,100)}...`);
            let displayHtml = `<div style="text-align: left; font-size: 0.85rem;"><p><b>Câu hỏi (${qLabel}):</b><br>${questionData.fullText.replace(/\n/g, '<br>')}</p>`;
            if(optionsString) displayHtml += `<p><b>Các lựa chọn:</b><br>${optionsString.replace(/\n/g, '<br>')}</p>`;
            displayHtml += `<hr style='margin: 10px 0;'>`;
            let suggestedOptionLetter = null;

            if (questionData.type === 'mcq') { /* ... Parsing logic same as v2.1 ... */
                 const answerMatch = aiAnswerRaw.match(/ANSWER:\s*([A-D])\b/i); const reasonMatch = aiAnswerRaw.match(/REASON:\s*(.*)/i); suggestedOptionLetter = answerMatch ? answerMatch[1].toUpperCase() : null; const reason = reasonMatch ? reasonMatch[1] : `(${HELPER_NAME} không cung cấp lý do/định dạng sai: ${aiAnswerRaw.substring(0,100)}...)`; displayHtml += `<b>${HELPER_NAME} gợi ý:</b> ${suggestedOptionLetter || 'Không xác định'}<br><b>Lý do ngắn gọn:</b> ${reason.replace(/</g, "<")}`; addLogEntry('info', `Hint for ${qLabel}: Suggests ${suggestedOptionLetter || 'N/A'}. Reason: ${reason.substring(0,100)}...`);
            } else { displayHtml += `<b>${HELPER_NAME} gợi ý trả lời:</b><br><div style="background:#eee; padding: 5px; border-radius:3px; max-height: 150px; overflow-y:auto;">${aiAnswerRaw.replace(/</g, "<").replace(/\n/g, '<br>')}</div>`; addLogEntry('info', `Hint for ${qLabel} (essay) provided.`); }
            displayHtml += `</div>`;

            Swal.fire({ title: `💡 ${HELPER_NAME} gợi ý cho ${qLabel}`, html: displayHtml, icon: suggestedOptionLetter || questionData.type === 'essay' ? 'info' : 'warning', confirmButtonText: 'Đã hiểu', width: '600px' });
            if (suggestedOptionLetter && questionData.options[suggestedOptionLetter]) { const targetContainer = questionData.options[suggestedOptionLetter].container; targetContainer.classList.add('highlight-answer-temp'); setTimeout(() => targetContainer.classList.remove('highlight-answer-temp'), 4500); }
        } catch (error) { /* ... Error handling same as v2.1 ... */ console.error(`Error showing hint for ${qLabel}:`, error); Swal.fire('Lỗi', `Không thể lấy gợi ý từ ${HELPER_NAME}: ${error}`, 'error'); addLogEntry('error', `Error showing hint for ${qLabel}: ${error}`);
        } finally { questionElement.classList.remove('processing-ai'); updateStatus("Sẵn sàng."); }
    }

    // --- Main Execution Flow ---
    async function startAnsweringWithWarning() { /* Same as v2.1 */
         Swal.fire({ title: '⚠️ Cảnh Báo Rủi Ro Cao!', html: `Tính năng <b>Auto-Answer</b> (tự động click/điền đáp án) có <b>nguy cơ RẤT CAO</b> bị Azota phát hiện và có thể dẫn đến <b>khóa tài khoản</b>.<br><br>Nó cũng có thể chọn sai đáp án do ${HELPER_NAME} (${DISPLAY_MODEL_NAME}) không hoàn hảo.<br><br><b>Chỉ sử dụng nếu bạn chấp nhận hoàn toàn rủi ro. Nên sử dụng "${HELPER_NAME} gợi ý" để an toàn hơn.</b><br><br>Bạn có chắc chắn muốn tiếp tục?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Tôi hiểu và chấp nhận rủi ro!', cancelButtonText: 'Hủy, quá nguy hiểm', confirmButtonColor: 'var(--ai-button-danger-bg)', cancelButtonColor: 'var(--ai-button-secondary-bg)', reverseButtons: true
        }).then(async (result) => { if (result.isConfirmed) { addLogEntry('warn', 'User confirmed understanding of auto-answer risks.'); await startAnswering(); } else { updateStatus("Đã hủy Auto-Answer do rủi ro."); addLogEntry('action', 'Auto-answer cancelled by user due to risk.'); } });
    }

    async function startAnswering() { /* Loop logic same as v2.1, but calls modified processEssay */
         if (!apiKey) { /* ... API key check ... */ updateStatus('Lỗi: Chưa nhập API Key!', true); Swal.fire('Lỗi', 'Vui lòng nhập Gemini API Key trước.', 'error'); await promptApiKey(); if (!apiKey) return; }
         stopProcessing = false; startButton.disabled = true; stopButton.disabled = false; setApiKeyButton.disabled = true; showAnswerButton.disabled = true;
         conversationHistory = []; // *** Clear history at the start of each full auto-run ***
         addLogEntry('action', '--- Auto Answering Started (History Cleared) ---');
         updateStatus('Bắt đầu quá trình tự động...');

         const questionElements = document.querySelectorAll('.azt-question.box');
         let questionIndex = 0; let answeredCount = 0; let errorCount = 0; let skippedCount = 0; const totalQuestions = questionElements.length;
         questionElements.forEach(el => { /* ... Clear previous states ... */
             el.classList.remove('processing-ai', 'answered-ai', 'error-ai'); el.querySelectorAll('.item-answer').forEach(item => { item.classList.remove('selected-by-ai', 'highlight-answer-temp'); const btn = item.querySelector('button.btn'); if (btn) { btn.classList.remove('selected-by-ai', 'btn-primary'); btn.classList.add('btn-outline-secondary', 'border-slate-400'); } }); el.querySelectorAll('textarea.filled-by-ai').forEach(ta => ta.classList.remove('filled-by-ai'));
         });

        for (const questionElement of questionElements) { if (stopProcessing) { updateStatus("Đã dừng bởi người dùng."); addLogEntry('action', '--- Auto Answering Stopped by User ---'); break; }
            questionIndex++; const qId = questionElement.id || `unknown_q_${questionIndex}`;
            questionElement.classList.add('processing-ai'); questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); updateStatus(`(${questionIndex}/${totalQuestions}) Chuẩn bị: ${qId}`); await sleep(600);
            const questionData = extractQuestionData(questionElement); const qLabel = questionData.questionLabel || `Câu ${questionIndex}`;

            if (questionData.type === 'instruction_only') { /* ... Skip instruction ... */ updateStatus(`(${questionIndex}/${totalQuestions}) Bỏ qua Instruction.`); addLogEntry('info', `Skipping instruction block ${qId}`); questionElement.classList.add('answered-ai'); skippedCount++;
            } else if (questionData.type === 'unknown' || (questionData.type === 'mcq' && Object.keys(questionData.options).length === 0) || (questionData.type === 'essay' && !questionData.textarea) ) { /* ... Skip unprocessable ... */ const skipMsg = `(${questionIndex}/${totalQuestions}) Lỗi: Không thể xử lý ${qLabel} (loại: ${questionData.type}). Bỏ qua.`; updateStatus(skipMsg, true); addLogEntry('error', `Cannot process ${qLabel} (type: ${questionData.type}). Skipping.`); questionElement.classList.add('error-ai'); errorCount++;
            } else { updateStatus(`(${questionIndex}/${totalQuestions}) ${HELPER_NAME} đang xử lý ${qLabel} (${questionData.type})...`);
                if (questionData.type === 'mcq') await processMCQ(questionData, questionElement);
                else if (questionData.type === 'essay') await processEssay(questionData, questionElement); // processEssay now adds to history internally
                if (questionElement.classList.contains('error-ai')) errorCount++; else if (questionElement.classList.contains('answered-ai')) answeredCount++; else { addLogEntry('warn', `Question ${qLabel} processed but no final state.`); errorCount++; questionElement.classList.add('error-ai'); }
            }
            questionElement.classList.remove('processing-ai');
            if (!stopProcessing && questionIndex < totalQuestions) { updateStatus(`(${questionIndex}/${totalQuestions}) Chờ ${REQUEST_DELAY / 1000}s...`); await sleep(REQUEST_DELAY); }
        }
        let finalMessage = stopProcessing ? `Đã dừng!` : `Hoàn thành!`; finalMessage += ` Trả lời: ${answeredCount}, Lỗi: ${errorCount}, Bỏ qua: ${skippedCount} / ${totalQuestions}.`; updateStatus(finalMessage, errorCount > 0); addLogEntry('action', `--- Auto Answering Finished: ${finalMessage} ---`);
        startButton.disabled = false; stopButton.disabled = true; setApiKeyButton.disabled = false; showAnswerButton.disabled = false;
    }

    function stopAnswering() { /* Same as v2.1 */
         stopProcessing = true; updateStatus("Đang yêu cầu dừng..."); startButton.disabled = false; stopButton.disabled = true; setApiKeyButton.disabled = false; showAnswerButton.disabled = false; document.querySelectorAll('.processing-ai').forEach(el => el.classList.remove('processing-ai'));
    }

    // --- Initialization ---
    function initialize() {
        addLogEntry('info', `Initializing ${HELPER_NAME} Helper v${SCRIPT_VERSION}`);
        makeDraggable(panelContainer, panelHeader, PANEL_POS_STORAGE); // Make main panel draggable
        makeDraggable(logPanel, logHeader, LOG_PANEL_POS_STORAGE); // Make log panel draggable

        if (isPanelCollapsed) panel.classList.add('collapsed');
        if (isLogVisible) logPanel.classList.add('visible');
        panelToggleIcon.textContent = isPanelCollapsed ? '▶' : '▼';

        startButton.addEventListener('click', startAnsweringWithWarning);
        stopButton.addEventListener('click', stopAnswering);
        setApiKeyButton.addEventListener('click', promptApiKey);
        panelToggleIcon.addEventListener('click', togglePanelCollapse);
        panelHeader.addEventListener('dblclick', togglePanelCollapse); // Keep dblclick toggle
        toggleLogButton.addEventListener('click', toggleLogPanel);
        clearLogButton.addEventListener('click', clearLog);
        showAnswerButton.addEventListener('click', showSingleAnswer);

        if (!apiKey) { updateStatus('Vui lòng nhập API Key.', true); addLogEntry('warn', 'API Key not found on init.'); }
        else { updateStatus(`${DISPLAY_MODEL_NAME} sẵn sàng!`); addLogEntry('info', `API Key loaded. Ready. Using ${GEMINI_MODEL} via ${HELPER_NAME}.`); }
        stopButton.disabled = true;
    }

    // --- Run ---
    if (document.readyState === 'complete') initialize();
    else window.addEventListener('load', initialize);

    // jQuery :contains check (keep from v2.1)
    try { if (jQuery && !jQuery.expr[':'].contains) { jQuery.expr[':'].contains = function(a, i, m) { return jQuery(a).text().toUpperCase().indexOf(m[3].toUpperCase()) >= 0; }; } else if (!jQuery) { console.warn(`${HELPER_NAME} Helper: jQuery not detected.`); } } catch (e) { console.error(`${HELPER_NAME} Helper: Err setting up jQuery :contains`, e); }

})();
