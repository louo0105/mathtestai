// 全域變數管理
let currentUser = null;
let userProgress = {};
let currentNode = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {}; // 暫存本次練習的答案狀況
let currentLevel = 'beginner'; // 預設難度

// DOM 元素
const loginPage = document.getElementById('login-page');
const dashboardPage = document.getElementById('dashboard-page');
const practicePage = document.getElementById('practice-page');
const teacherPage = document.getElementById('teacher-page');

const studentInput = document.getElementById('student-number');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');

// 新增追蹤變數
let practiceStartTime = null;
let customMapping = JSON.parse(localStorage.getItem('custom_student_mapping'));
let currentTeacherId = 'admin'; // 當前登入學生的指導老師或系統管理員 ID
let isAiMode = false; // 目前所在環境的 AI 模式狀態

// 獲取目前的學生清單（優先使用自定義，區分老師）
function getMapping() {
    const teacherMappingStr = localStorage.getItem(`custom_mapping_${currentTeacherId}`);
    const teacherMapping = teacherMappingStr ? JSON.parse(teacherMappingStr) : null;
    return teacherMapping || STUDENT_MAPPING;
}

// 將 Python 生成的額外題庫合併進原有題庫中
function mergeExtraQuestions() {
    console.log("📥 開始合併額外題庫...");
    let cleanedCount = 0;
    let mergedNodes = 0;
    let totalQuestions = 0;

    // 1. 強制清除舊有的假佔位符題目 (避免殘留)
    // 修正：僅對比特定的預設關鍵字，避免誤刪包含「錯誤」二字的真實題目
    Object.keys(QUESTION_BANK).forEach(node => {
        ['beginner', 'intermediate', 'advanced'].forEach(level => {
            if (QUESTION_BANK[node] && QUESTION_BANK[node][level]) {
                const before = QUESTION_BANK[node][level].length;
                QUESTION_BANK[node][level] = QUESTION_BANK[node][level].filter(q => {
                    const isFake1 = q.options.some(opt => opt.includes('錯誤值') || opt.includes('正確結果'));
                    const isFake2 = q.exp && q.exp.includes('基礎題型');
                    const isFake3 = q.options.some(opt => opt.includes('此為正確的觀念描述') || opt.includes('該觀念的錯誤誤解') || opt.includes('完全不相干的描述'));
                    return !isFake1 && !isFake2 && !isFake3;
                });
                cleanedCount += (before - QUESTION_BANK[node][level].length);
            }
        });
    });

    // 2. 將新的題庫合併進來
    if (typeof EXTRA_QUESTION_BANK !== 'undefined') {
        for (const node in EXTRA_QUESTION_BANK) {
            const cleanNode = node.trim().toUpperCase();
            if (!QUESTION_BANK[cleanNode]) QUESTION_BANK[cleanNode] = { beginner: [], intermediate: [], advanced: [] };
            
            mergedNodes++;
            for (const level in EXTRA_QUESTION_BANK[node]) {
                if (!QUESTION_BANK[cleanNode][level]) QUESTION_BANK[cleanNode][level] = [];
                const extraQs = EXTRA_QUESTION_BANK[node][level];
                QUESTION_BANK[cleanNode][level] = QUESTION_BANK[cleanNode][level].concat(extraQs);
                totalQuestions += extraQs.length;
            }
        }
    }
    console.log(`✅ 題庫整理完畢：清理了 ${cleanedCount} 題預設題，成功合併 ${mergedNodes} 個結點，共 ${totalQuestions} 題額外題目。`);
}

// 初始化
async function init() {
    try {
        console.log("🚀 系統啟動中...");
        
        // Step 1: 立即確保登入畫面顯示
        loginPage.classList.add('active');
        
        setupEventListeners();
        mergeExtraQuestions();
        
        console.log("👤 檢查自動登入...");
        await checkAutoLogin();
        
        console.log("✨ 系統初始化成功！");
        // 顯示一個小小的 Toast 提示初始化成功
        const toast = document.createElement('div');
        toast.style = "position:fixed; bottom:20px; right:20px; background:rgba(0,122,255,0.8); color:white; padding:10px 20px; border-radius:30px; z-index:9999; font-size:12px;";
        toast.textContent = "✅ 系統已就緒";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);

    } catch (err) {
        console.error("❌ 系統啟動失敗:", err);
        loginPage.classList.add('active');
    }
}

function setupEventListeners() {
    loginBtn.addEventListener('click', handleLogin);
    studentInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('back-btn').addEventListener('click', showDashboard);
    document.getElementById('prev-btn').addEventListener('click', prevQuestion);
    document.getElementById('next-btn').addEventListener('click', nextQuestion);
    document.getElementById('finish-btn').addEventListener('click', finishPractice);

    // 難度選擇
    document.querySelectorAll('.diff-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.diff-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentLevel = e.target.dataset.level;
            renderNodes(); // 重新渲染卡片狀態
        });
    });

    // 教師端監聽
    document.getElementById('teacher-back-btn').addEventListener('click', handleLogout);
    document.getElementById('refresh-btn').addEventListener('click', renderTeacherDashboard);
    document.getElementById('student-search').addEventListener('input', renderTeacherDashboard);
    document.getElementById('clear-records-btn').addEventListener('click', clearRecords);

    // ODS 上傳處理
    const odsInput = document.getElementById('ods-input');
    const dropZone = document.getElementById('drop-zone');

    odsInput.addEventListener('change', (e) => handleOdsUpload(e.target.files[0]));
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleOdsUpload(e.dataTransfer.files[0]);
    });

    // AI 模式切換
    const aiToggle = document.getElementById('ai-mode-toggle');
    if (aiToggle) {
        aiToggle.addEventListener('change', async (e) => {
            const success = await DatabaseService.updateSystemSettings(e.target.checked, currentTeacherId);
            if (success) {
                isAiMode = e.target.checked;
                updateAIStatusUI();
            } else {
                alert('更新失敗，請檢查網路連線。');
                e.target.checked = !e.target.checked;
            }
        });
    }
}

// 登入處理
async function handleLogin() {
    const num = studentInput.value.trim().toLowerCase();
    if (!num) {
        showError('請輸入號碼');
        return;
    }

    // 教師登入判斷
    if (['admin', 'teacher', 'admin3', 'admin4', 'admin6'].includes(num)) {
        currentTeacherId = num === 'teacher' ? 'admin' : num;
        localStorage.setItem('quiz_teacher_id', currentTeacherId);
        
        // 抓取該老師目前的 AI 設定
        if (typeof DatabaseService !== 'undefined') {
            const settings = await DatabaseService.getSystemSettings(currentTeacherId);
            isAiMode = (settings && settings.ai_mode) || false;
        }

        showTeacherPage();
        return;
    }

    // 優先從資料庫撈取，若無則用本地 mapping
    let studentData = await DatabaseService.getStudent(num);

    if (studentData) {
        currentUser = { ...studentData, weakNodes: studentData.weak_nodes };
        currentTeacherId = studentData.teacher_id || 'admin';
    } else {
        const mapping = getMapping(); // 依據當前偵測到的老師 ID 獲取名單
        if (mapping[num]) {
            currentUser = { ...mapping[num], id: num };
            currentTeacherId = mapping[num].teacher_id || 'admin';
        }
    }

    if (currentUser) {
        localStorage.setItem('quiz_user_id', num);
        localStorage.setItem('quiz_teacher_id', currentTeacherId);
        
        // 依照該學生的老師載入相對應的 AI 設定
        if (typeof DatabaseService !== 'undefined') {
            console.log(`🔍 正在同步師生 AI 設定 (Teacher ID: ${currentTeacherId})...`);
            let settings = await DatabaseService.getSystemSettings(currentTeacherId);
            
            // Fallback: 如果該老師沒設定或關閉，檢查管理員 (admin) 是否開啟了全局 AI
            if ((!settings || !settings.ai_mode) && currentTeacherId !== 'admin') {
                console.log("ℹ️ 指導老師未開啟 AI，檢查管理員全局設定...");
                const adminSettings = await DatabaseService.getSystemSettings('admin');
                if (adminSettings && adminSettings.ai_mode) {
                    settings = adminSettings;
                    console.log("✅ 已繼承管理員全局 AI 設定");
                }
            }
            
            isAiMode = (settings && settings.ai_mode) || false;
            updateAIStatusUI();
            
            if (isAiMode) {
                console.log("🤖 AI 出題模式已準備就緒，將優先啟動即時生成。");
            }
        }
        
        await loadUserProgress(num);
        showDashboard();
    } else {
        showError('找不到該號碼，請重新輸入');
    }
}

async function checkAutoLogin() {
    const savedId = localStorage.getItem('quiz_user_id');
    const savedTeacherId = localStorage.getItem('quiz_teacher_id');
    
    if (savedTeacherId) currentTeacherId = savedTeacherId;
    
    if (!savedId) return;

    let studentData = await DatabaseService.getStudent(savedId);
    const mapping = getMapping();

    if (studentData) {
        currentUser = { ...studentData, weakNodes: studentData.weak_nodes };
        currentTeacherId = studentData.teacher_id || 'admin';
    } else if (mapping[savedId]) {
        currentUser = { ...mapping[savedId], id: savedId };
        currentTeacherId = mapping[savedId].teacher_id || 'admin';
    }

    if (currentUser) {
        // 設定依據老師 ID
        if (typeof DatabaseService !== 'undefined') {
            console.log(`🔍 自動登入同步 AI 設定 (Teacher ID: ${currentTeacherId})...`);
            let settings = await DatabaseService.getSystemSettings(currentTeacherId);
            
            // Fallback
            if ((!settings || !settings.ai_mode) && currentTeacherId !== 'admin') {
                const adminSettings = await DatabaseService.getSystemSettings('admin');
                if (adminSettings && adminSettings.ai_mode) {
                    settings = adminSettings;
                }
            }

            isAiMode = (settings && settings.ai_mode) || false;
            updateAIStatusUI();
        }
        
        await loadUserProgress(savedId);
        showDashboard();
    }
}

function handleLogout() {
    localStorage.removeItem('quiz_user_id');
    currentUser = null;
    userProgress = {}; // 清除進度暫存
    hideAllPages();
    loginPage.classList.add('active');
}

// 進度管理
async function loadUserProgress(userId) {
    // 優先從雲端讀取
    const cloudProgress = await DatabaseService.getProgress(userId);

    // 與本地合併 (若雲端無資料則回歸本地 localStorage)
    const localSaved = localStorage.getItem(`quiz_progress_${userId}`);
    const localProgress = localSaved ? JSON.parse(localSaved) : {};

    userProgress = { ...localProgress, ...cloudProgress };
}

function saveProgress() {
    if (currentUser) {
        localStorage.setItem(`quiz_progress_${currentUser.id}`, JSON.stringify(userProgress));
    }
}

// 導航
function hideAllPages() {
    [loginPage, dashboardPage, practicePage, teacherPage].forEach(p => p.classList.remove('active'));
}

function showDashboard() {
    hideAllPages();
    dashboardPage.classList.add('active');
    document.getElementById('user-name').textContent = `${currentUser.name} 同學`;
    renderNodes();
}

function showTeacherPage() {
    hideAllPages();
    teacherPage.classList.add('active');
    renderTeacherDashboard();

    // 每 30 秒自動重新整理數據 (動態監控)
    if (window.teacherInterval) clearInterval(window.teacherInterval);
    window.teacherInterval = setInterval(() => {
        if (teacherPage.classList.contains('active')) {
            renderTeacherDashboard();
        } else {
            clearInterval(window.teacherInterval);
        }
    }, 30000);

    // 更新 AI 切換開關狀態
    const aiToggle = document.getElementById('ai-mode-toggle');
    if (aiToggle) {
        aiToggle.checked = isAiMode;
        updateAIStatusUI();
    }
}

function updateAIStatusUI() {
    const badge = document.getElementById('ai-status-badge');
    if (badge) {
        badge.textContent = isAiMode ? '✓ 啟用中' : '未啟用';
        badge.className = `status-badge ${isAiMode ? 'completed' : ''}`;
    }

    // 儀表板診斷標籤
    const diagnostic = document.getElementById('ai-diagnostic-info');
    if (diagnostic) {
        if (isAiMode) {
            diagnostic.classList.add('active');
            diagnostic.innerHTML = `<span class="dot"></span> 🤖 AI 即時出題：開啟中 (管理員/老師: ${currentTeacherId})`;
        } else {
            diagnostic.classList.remove('active');
            diagnostic.innerHTML = `<span class="dot"></span> 📚 本地題庫模式 (Teacher: ${currentTeacherId})`;
        }
    }
}

function renderNodes() {
    const grid = document.getElementById('nodes-grid');
    grid.innerHTML = '';

    // 使用 Set 確保沒有重複的弱點卡片
    const uniqueWeakNodes = [...new Set(currentUser.weakNodes)];

    uniqueWeakNodes.forEach(nodeCode => {
        const isCompleted = userProgress[`${nodeCode}_${currentLevel}`] === true;
        const lastScore = userProgress[`${nodeCode}_${currentLevel}_score`];
        const description = NODES_DESCRIPTIONS[nodeCode] || "數學知識點";

        const card = document.createElement('div');
        card.className = 'node-card';
        card.innerHTML = `
            <div>
                <span class="node-code">${nodeCode}</span>
                <h3 class="node-name">${description}</h3>
                <span class="status-badge ${isCompleted ? 'completed' : ''}">
                    ${isCompleted ? '✓ 練習完成' : '未練習'}
                </span>
                ${isCompleted && lastScore ? `<span class="last-score">上次得分：${lastScore}</span>` : ''}
            </div>
            <button class="btn-outline" style="margin-top: 20px" onclick="startPractice('${nodeCode}')">
                ${isCompleted ? '再次挑戰' : '開始練習'}
            </button>
        `;
        grid.appendChild(card);
    });
}

// 搜尋節點題目 (含階層式搜尋：若找不到 N-5-1-S01，嘗試 N-5-1，再嘗試 N-5)
function getHierarchicalQuestions(nodeCode, level) {
    let currentCode = String(nodeCode || "").trim().toUpperCase();
    while (currentCode) {
        if (QUESTION_BANK[currentCode] && 
            QUESTION_BANK[currentCode][level] && 
            QUESTION_BANK[currentCode][level].length > 0) {
            
            if (currentCode !== nodeCode) {
                console.log(`ℹ️ 原節點 [${nodeCode}] 無題，已成功匹配父節點 [${currentCode}] 的題目。`);
            }
            return {
                questions: JSON.parse(JSON.stringify(QUESTION_BANK[currentCode][level])),
                matchedCode: currentCode
            };
        }
        
        // 嘗試去掉最後一段 (例如 N-5-1-S01 -> N-5-1)
        const parts = currentCode.split('-');
        if (parts.length <= 1) break;
        parts.pop();
        currentCode = parts.join('-');
    }
    return { questions: [], matchedCode: null };
}

// 練習邏輯
window.startPractice = async function (nodeCode) {
    if (nodeCode) nodeCode = String(nodeCode).trim().toUpperCase();
    currentNode = nodeCode;
    
    const nodeLabel = (typeof NODES_DESCRIPTIONS !== 'undefined' && NODES_DESCRIPTIONS[nodeCode]) ? NODES_DESCRIPTIONS[nodeCode] : nodeCode;
    let finalQuestions = [];

    // --- 即時同步 AI 模式狀態 (確保教師後台開關即時生效) ---
    if (typeof DatabaseService !== 'undefined') {
        try {
            const settings = await DatabaseService.getSystemSettings(currentTeacherId);
            isAiMode = (settings && settings.ai_mode) || false;
            updateAIStatusUI(); // 同步 UI 狀態
            console.log(`🌐 即時同步 AI 模式: ${isAiMode ? '開啟' : '關閉'}`);
        } catch (e) {
            console.warn("無法即時同步 AI 模式，將使用上次快取狀態。");
        }
    }

    // --- AI 出題模式 (優先權最高) ---
    if (isAiMode) {
        showToast("🤖 AI 出題模式：正在即時生成新題目...", "info");
        const overlay = document.getElementById('ai-loading-overlay');
        if (overlay) overlay.classList.remove('hidden');

        try {
            console.log("🚀 啟動 AI 出題流程...");
            const aiQuestions = await DatabaseService.generateAIQuestions(nodeCode, nodeLabel, currentLevel);
            
            if (aiQuestions && aiQuestions.length >= 5) {
                finalQuestions = aiQuestions.map(q => ({ ...q, source: '🤖 AI 即時生成' }));
                console.log("✅ 成功使用 AI 即時生成題目");
                showToast("✅ AI 題目生成成功", "success");
            } else {
                console.warn("AI 生成題目不足，將切換至備援題庫。");
                showToast("⚠️ AI 生成題目不足，已切換至本地備援", "warning");
            }
        } catch (err) {
            console.error("❌ AI 出題失敗:", err);
            // 這裡會顯示從 db.js 拋出的具體錯誤訊息（如：額度已滿）
            showToast(`❌ AI 出題失敗: ${err.message}`, "error");
        } finally {
            if (overlay) overlay.classList.add('hidden');
        }
    }

    // --- 本地題庫處理 (Fallback) ---
    if (finalQuestions.length === 0) {
        if (isAiMode) {
             console.log("ℹ️ 由於 AI 無回應，啟動本地備援機制。");
        }
        // 使用階層式搜尋
        const { questions: localQuestions, matchedCode } = getHierarchicalQuestions(nodeCode, currentLevel);
        
        if (localQuestions.length > 0) {
            finalQuestions = localQuestions.map(q => ({ ...q, source: '📚 本地題庫' }));
            if (matchedCode !== nodeCode) {
                const parentLabel = (typeof NODES_DESCRIPTIONS !== 'undefined' && NODES_DESCRIPTIONS[matchedCode]) ? NODES_DESCRIPTIONS[matchedCode] : matchedCode;
                console.log(`ℹ️ 使用 [${matchedCode}] 替代 [${nodeCode}]`);
            }
        }
        
        // 【動態防呆】如果連父節點都沒有，才產出防呆題
        if (finalQuestions.length === 0) {
            const lvlName = { 'beginner': '初級', 'intermediate': '中級', 'advanced': '高級' }[currentLevel];
            for(let k=1; k<=5; k++) {
                finalQuestions.push({
                    q: `【題庫補充中】針對「${nodeLabel}」目前尚無匹配題目。此為系統產出的防呆題（${lvlName} 第 ${k} 題）。\n\n請問 1+1 等於多少？`,
                    options: ['2', '3', '4', '5'],
                    correct: 0,
                    exp: "系統正在擴充此知識點的題目，請開啟 AI 模式以獲取即時生成題目。",
                    source: '⚠️ 防呆代換'
                });
            }
        }

        // 隨機打亂並取 5 題
        finalQuestions = [...finalQuestions].sort(() => 0.5 - Math.random()).slice(0, 5);
    }

    if (finalQuestions.length === 0) {
        alert("目前該難度尚無題目。");
        return;
    }

    currentQuestions = finalQuestions;
    currentQuestionIndex = 0;
    userAnswers = {};
    practiceStartTime = new Date();

    hideAllPages();
    practicePage.classList.add('active');

    const levelName = { 'beginner': '初級', 'intermediate': '中級', 'advanced': '高級' }[currentLevel];
    document.getElementById('current-node-title').textContent = `${nodeCode} (${levelName})`;
    updateQuestionUI();
};

function updateQuestionUI() {
    const q = currentQuestions[currentQuestionIndex];
    const sourceTag = q.source ? ` <span class="source-badge">${q.source}</span>` : "";
    document.getElementById('question-number').innerHTML = `第 ${currentQuestionIndex + 1} / ${currentQuestions.length} 題${sourceTag}`;
    document.getElementById('question-text').textContent = q.q;

    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';

    const feedbackArea = document.getElementById('feedback-area');
    feedbackArea.classList.add('hidden');

    const previousAnswer = userAnswers[currentQuestionIndex];

    q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = `<strong>${String.fromCharCode(65 + idx)}.</strong> ${opt}`;

        btn.addEventListener('click', () => handleOptionSelect(idx));

        // 如果已經作答過
        if (previousAnswer !== undefined) {
            btn.disabled = true;
            if (idx === q.correct) btn.classList.add('correct');
            if (idx === previousAnswer && idx !== q.correct) btn.classList.add('wrong');
        }

        optionsContainer.appendChild(btn);
    });

    if (previousAnswer !== undefined) showFeedback(previousAnswer === q.correct);

    // 按鈕控制
    document.getElementById('prev-btn').style.visibility = (currentQuestionIndex > 0) ? 'visible' : 'hidden';

    const isLast = currentQuestionIndex === currentQuestions.length - 1;
    document.getElementById('next-btn').classList.toggle('hidden', isLast);
    document.getElementById('finish-btn').classList.toggle('hidden', !isLast);

    // 進度條
    const progress = ((currentQuestionIndex + 1) / currentQuestions.length) * 100;
    document.getElementById('progress-bar').style.width = `${progress}%`;
}

function handleOptionSelect(index) {
    const q = currentQuestions[currentQuestionIndex];
    userAnswers[currentQuestionIndex] = index;

    const btns = document.querySelectorAll('.option-btn');
    btns.forEach((btn, idx) => {
        btn.disabled = true;
        if (idx === q.correct) btn.classList.add('correct');
        if (idx === index && idx !== q.correct) btn.classList.add('wrong');
    });

    showFeedback(index === q.correct);
}

function showFeedback(isCorrect) {
    const q = currentQuestions[currentQuestionIndex];
    const feedbackArea = document.getElementById('feedback-area');
    const banner = document.getElementById('result-banner');

    feedbackArea.classList.remove('hidden');
    banner.textContent = isCorrect ? '✨ 太棒了！答對了！' : '📌 加油！正確答案如上標示。';
    banner.className = `result-banner ${isCorrect ? 'success' : 'error'}`;

    document.getElementById('explanation-text').textContent = q.exp;
}

function nextQuestion() {
    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        updateQuestionUI();
    }
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        updateQuestionUI();
    }
}

async function finishPractice() {
    if (Object.keys(userAnswers).length < currentQuestions.length) {
        alert("請完成所有題目後再完成練習。");
        return;
    }

    const endTime = new Date();
    const duration = Math.floor((endTime - practiceStartTime) / 1000); // 秒
    let correctCount = 0;
    currentQuestions.forEach((q, idx) => {
        if (userAnswers[idx] === q.correct) correctCount++;
    });

    // 將該節點在該難度的狀態記為完成
    userProgress[`${currentNode}_${currentLevel}`] = true;
    userProgress[`${currentNode}_${currentLevel}_score`] = `${correctCount}/${currentQuestions.length}`;
    saveProgress();

    // 存入雲端資料庫 (加入 Await 確保傳送完成，加入 teacher_id 區分)
    const success = await DatabaseService.saveQuizResult(
        currentUser.id,
        currentUser.name,
        currentNode,
        currentLevel,
        correctCount,
        currentQuestions.length,
        duration,
        currentTeacherId
    );

    if (success) {
        alert(`🎉 恭喜完成並同步成功！答對 ${correctCount} / ${currentQuestions.length} 題。`);
    } else {
        alert(`完成練習！答對 ${correctCount} / ${currentQuestions.length} 題。(但雲端同步失敗，請確認網路或聯絡老師)`);
    }
    showDashboard();
}

function saveQuizRecord(correct, total, seconds) {
    const records = JSON.parse(localStorage.getItem('quiz_total_records') || '[]');
    records.push({
        studentId: currentUser.id,
        name: currentUser.name,
        node: currentNode,
        level: currentLevel,
        score: `${correct}/${total}`,
        accuracy: Math.round((correct / total) * 100) + '%',
        duration: seconds,
        time: new Date().toLocaleString()
    });
    localStorage.setItem('quiz_total_records', JSON.stringify(records));
}

// 教師後台邏輯
function handleOdsUpload(file) {
    if (!file) return;
    const status = document.getElementById('upload-status');
    status.textContent = "正在處理檔案...";
    status.className = "status-msg";

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            // 1. 初始化資料結構
            const newMapping = {};
            const headerRow0 = jsonData[0] || []; 
            const headerRow1 = jsonData[1] || []; 
            const headerRow2 = jsonData[2] || []; 
            
            // 2. 第一階段：建立知識點欄位索引地圖 (處理合併儲存格邏輯)
            const nodeGroups = {}; 
            let activeNodeCode = null;
            let nodeStartIndices = [];

            // 先找出所有起始點
            for (let j = 0; j < Math.max(headerRow0.length, headerRow2.length); j++) {
                const cell0 = String(headerRow0[j] || "").trim();
                if (cell0 !== "" && cell0 !== "undefined" && cell0 !== "學生" && cell0 !== "完成率") {
                    const code = cell0.split(' ')[0].toUpperCase();
                    if (code.includes('-')) {
                        activeNodeCode = code;
                        nodeStartIndices.push({ code: code, start: j });
                        // 紀錄描述
                        const desc = cell0.split(' ').slice(1).join(' ').trim() || code;
                        if (typeof window.NODES_DESCRIPTIONS !== 'undefined') {
                             window.NODES_DESCRIPTIONS[code] = desc;
                        }
                    }
                }
            }

            // 根據起始點計算每個節點的管轄範圍 (直到下一個起始點或結束)
            for (let k = 0; k < nodeStartIndices.length; k++) {
                const node = nodeStartIndices[k];
                const start = node.start;
                const end = (k + 1 < nodeStartIndices.length) ? nodeStartIndices[k + 1].start - 1 : headerRow2.length - 1;
                
                nodeGroups[node.code] = [];
                for (let col = start; col <= end; col++) {
                    nodeGroups[node.code].push(col);
                }
            }

            // 3. 第二階段：解析每位學生的資料
            let fallbackId = 1;
            for (let i = 3; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0) continue;

                // 解析姓名與 ID
                let nameStr = String(row[0] || "").trim();
                if (!nameStr || nameStr === 'undefined') continue;

                let id = String(fallbackId);
                let name = nameStr;
                
                // 擴充支援：中文年級轉數字 (例如 "三年" -> "3", "五年" -> "5")
                const gradeMap = { "一": "1", "二": "2", "三": "3", "四": "4", "五": "5", "六": "6" };
                let gradeNum = "";
                
                const matchGradeNum = nameStr.match(/(\d+)年/);
                const matchGradeChi = nameStr.match(/([一二三四五六])年/);
                
                if (matchGradeNum) {
                    gradeNum = matchGradeNum[1];
                } else if (matchGradeChi) {
                    gradeNum = gradeMap[matchGradeChi[1]];
                }
                
                const matchNum = nameStr.match(/(\d+)號/);
                if (matchNum) {
                    let numStr = matchNum[1].padStart(2, '0');
                    id = gradeNum ? gradeNum + numStr : numStr;
                    name = nameStr.replace(/.*?(\d+)號\s*/, '').trim(); 
                } else if (nameStr.match(/^\d+/)) {
                    let numRaw = nameStr.match(/^(\d+)/)[1];
                    id = gradeNum ? gradeNum + numRaw.padStart(2, '0') : numRaw.padStart(2, '0');
                    name = nameStr.replace(/^\d+\s*/, '').trim();
                } else { fallbackId++; }
                if (name === "") name = nameStr;

                // 4. 第三階段：核心弱點判定 (嚴格遵守：只看「答對率」那一欄，即區塊最後一欄)
                const weakNodes = [];
                for (let code in nodeGroups) {
                    const cols = nodeGroups[code];
                    if (cols.length === 0) continue;

                    // 取得該節點區塊的最後一欄（即答對率）
                    const rateColIdx = cols[cols.length - 1];
                    let val = String(row[rateColIdx] !== undefined ? row[rateColIdx] : "").trim();

                    if (val !== "" && val !== "-") {
                        let fVal = parseFloat(val);
                        // 只要答對率低於 100 就算弱點
                        if (!isNaN(fVal) && fVal < 100) {
                            weakNodes.push(code);
                        }
                    }
                }

                newMapping[id] = {
                    name: name,
                    fullName: nameStr,
                    weakNodes: [...new Set(weakNodes)]
                };
            }

            // 5. 更新本地儲存與全域狀態
            localStorage.setItem(`custom_mapping_${currentTeacherId}`, JSON.stringify(newMapping));
            customMapping = newMapping;

            status.textContent = `🔄 正在為教師 [${currentTeacherId}] 清理舊資料並同步新名單...`;
            
            // 6. 清空雲端的舊有資料並同步
            await DatabaseService.clearAllDataForNewUpload(currentTeacherId);
            await DatabaseService.syncStudents(newMapping, currentTeacherId);

            status.textContent = "✅ 名單與弱點抓取更新成功！";
            status.classList.add('success');
            renderTeacherDashboard();

        } catch (err) {
            console.error(err);
            status.textContent = "❌ 解析失敗，請檢查檔案格式。";
            status.classList.add('error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function renderTeacherDashboard() {
    renderProgressOverview();
    renderActivityLog();
}

async function renderProgressOverview() {
    const tbody = document.getElementById('summary-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">載入數據中...</td></tr>';

    // 1. 獲取特定教師的「雲端學生名單」與「雲端進度」
    let [cloudStudents, allCloudProgress] = await Promise.all([
        DatabaseService.getAllStudents(currentTeacherId).catch(() => []),
        DatabaseService.getAllProgress(currentTeacherId).catch(() => [])
    ]);

    // 降級防護：如果雲端因連線或設定問題抓不到名單，但本地已有上傳解析過的 customMapping，就作爲備援顯示
    if ((!cloudStudents || cloudStudents.length === 0) && customMapping && Object.keys(customMapping).length > 0) {
        cloudStudents = Object.keys(customMapping).map(id => ({
            id: id,
            name: customMapping[id].name,
            weak_nodes: customMapping[id].weakNodes
        }));
    }

    tbody.innerHTML = '';

    if (!cloudStudents || cloudStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #ff4d4f;">尚無學生名單資料。請先上傳 ODS 檔案或檢查雲端連線狀況。</td></tr>';
        return;
    }

    // 依照座號排序
    cloudStudents.sort((a, b) => parseInt(a.id) - parseInt(b.id));

    cloudStudents.forEach(student => {
        const studentWeakNodes = [...new Set(student.weak_nodes || [])];
        const totalPossible = studentWeakNodes.length;

        // 篩選該學生的進度，強制轉為字串比對避免雷同的 id 型別錯誤
        const pList = allCloudProgress.filter(p => String(p.student_id) === String(student.id));
        const progress = pList.reduce((acc, cur) => {
            acc[`${cur.node_code}_${cur.level}`] = cur.is_completed;
            return acc;
        }, {});

        let completedCount = 0;
        let bCount = 0, iCount = 0, aCount = 0;

        studentWeakNodes.forEach(node => {
            if (progress[`${node}_beginner`]) { completedCount++; bCount++; }
            if (progress[`${node}_intermediate`]) { completedCount++; iCount++; }
            if (progress[`${node}_advanced`]) { completedCount++; aCount++; }
        });

        const totalTasks = totalPossible * 3; // 三個難度
        const percent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${student.id}</td>
            <td>${student.name}</td>
            <td>${totalPossible} 個弱點</td>
            <td>${bCount} / ${iCount} / ${aCount}</td>
            <td>${percent}%</td>
            <td>
                <span class="progress-tag ${percent >= 80 ? 'high' : 'low'}">
                    ${percent >= 80 ? '表現優異' : percent >= 30 ? '穩定練習' : '尚未開始'}
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function renderActivityLog() {
    const tbody = document.getElementById('report-tbody');
    const search = document.getElementById('student-search').value.toLowerCase();

    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">載入數據中...</td></tr>';

    // 從雲端獲取該老師的學生紀錄
    const records = await DatabaseService.getAllLogs(currentTeacherId);

    tbody.innerHTML = '';

    // 過濾搜尋
    const filtered = records.filter(r => {
        const nameMatch = r.name && String(r.name).toLowerCase().includes(search);
        const idMatch = r.student_id && String(r.student_id).includes(search);
        return nameMatch || idMatch;
    });

    filtered.forEach(r => {
        const tr = document.createElement('tr');
        const levelName = { 'beginner': '初級', 'intermediate': '中級', 'advanced': '高級' }[r.level];
        const nodeTitle = NODES_DESCRIPTIONS[r.node_code] || r.node_code;
        tr.innerHTML = `
            <td>${r.student_id}</td>
            <td>${r.name}</td>
            <td><span class="node-code" style="margin:0">${r.node_code}</span><br>${nodeTitle}</td>
            <td>${levelName}</td>
            <td>${r.accuracy} (${r.score})</td>
            <td>${formatDuration(r.duration)}</td>
            <td>${new Date(r.created_at).toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
    });
}

function clearRecords() {
    if (confirm(`確定要清空 教師[${currentTeacherId}] 的雲端活動紀錄嗎？這不會影響學生的練習進度。`)) {
        DatabaseService.clearAllLogs(currentTeacherId).then(() => {
            renderTeacherDashboard();
        });
    }
}

function formatDuration(sec) {
    if (sec < 60) return sec + '秒';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}分${s}秒`;
}

function showError(msg) {
    loginError.textContent = msg;
    setTimeout(() => { loginError.textContent = ''; }, 3000);
}

// 通用 UI 提示 (Toast)
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colors = {
        'info': '#007AFF',
        'success': '#34C759',
        'warning': '#FF9500',
        'error': '#FF3B30'
    };
    
    toast.className = 'toast-msg glass';
    toast.style = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 16px rgba(0,0,0,0.15);
        z-index: 10000;
        font-size: 14px;
        font-weight: 600;
        animation: toastSlideIn 0.3s ease-out forwards;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// 動畫 CSS 動態加入
const toastStyle = document.createElement('style');
toastStyle.textContent = `
    @keyframes toastSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes toastSlideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
`;
document.head.appendChild(toastStyle);

init();
