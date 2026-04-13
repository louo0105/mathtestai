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
    // 1. 強制清除舊有的假佔位符題目 (避免殘留)
    Object.keys(QUESTION_BANK).forEach(node => {
        ['beginner', 'intermediate', 'advanced'].forEach(level => {
            if (QUESTION_BANK[node] && QUESTION_BANK[node][level]) {
                QUESTION_BANK[node][level] = QUESTION_BANK[node][level].filter(q => {
                    return !q.options.some(opt => opt.includes('錯誤值') || opt.includes('正確結果') || opt.includes('錯誤'));
                });
            }
        });
    });

    // 2. 將新的題庫合併進來
    if (typeof EXTRA_QUESTION_BANK !== 'undefined') {
        for (const node in EXTRA_QUESTION_BANK) {
            if (!QUESTION_BANK[node]) QUESTION_BANK[node] = { beginner: [], intermediate: [], advanced: [] };
            for (const level in EXTRA_QUESTION_BANK[node]) {
                if (!QUESTION_BANK[node][level]) QUESTION_BANK[node][level] = [];
                // 使用 concat 避免 spread operator (...) 在大數據量下發生堆疊溢位 (Stack Overflow)
                QUESTION_BANK[node][level] = QUESTION_BANK[node][level].concat(EXTRA_QUESTION_BANK[node][level]);
            }
        }
    }
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
            const settings = await DatabaseService.getSystemSettings(currentTeacherId);
            isAiMode = (settings && settings.ai_mode) || false;
            updateAIStatusUI();
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
            const settings = await DatabaseService.getSystemSettings(currentTeacherId);
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

// 練習邏輯
window.startPractice = async function (nodeCode) {
    if (nodeCode) nodeCode = String(nodeCode).toUpperCase();
    currentNode = nodeCode;
    
    const nodeLabel = (typeof NODES_DESCRIPTIONS !== 'undefined' && NODES_DESCRIPTIONS[nodeCode]) ? NODES_DESCRIPTIONS[nodeCode] : nodeCode;
    let finalQuestions = [];

    // --- AI 出題模式 ---
    if (isAiMode) {
        const overlay = document.getElementById('ai-loading-overlay');
        overlay.classList.remove('hidden');

        const aiQuestions = await DatabaseService.generateAIQuestions(nodeCode, nodeLabel, currentLevel);
        overlay.classList.add('hidden');

        if (aiQuestions && aiQuestions.length >= 5) {
            finalQuestions = aiQuestions;
            console.log("使用 AI 生成題目成功");
        } else {
            console.warn("AI 出題失敗或格式不符，改用本地題庫。");
        }
    }

    // --- 本地題庫處理 (Fallback) ---
    if (finalQuestions.length === 0) {
        // 初始化題庫結構
        if (!QUESTION_BANK[nodeCode]) {
            QUESTION_BANK[nodeCode] = { beginner: [], intermediate: [], advanced: [] };
        }

        // 【動態防呆】檢查
        ['beginner', 'intermediate', 'advanced'].forEach(lvl => {
            if (!QUESTION_BANK[nodeCode][lvl] || QUESTION_BANK[nodeCode][lvl].length === 0) {
                QUESTION_BANK[nodeCode][lvl] = [];
                const lvlName = { 'beginner': '初級', 'intermediate': '中級', 'advanced': '高級' }[lvl];
                for(let k=1; k<=5; k++) {
                    QUESTION_BANK[nodeCode][lvl].push({
                        q: `【動態補上題庫】針對「${nodeLabel}」目前尚無真實題目。此為系統自動產出的防呆替換題（${lvlName} 第 ${k} 題）。\n\n請問 1+1 等於多少？`,
                        options: ['2', '3', '4', '5'],
                        correct: 0,
                        exp: '此題目為臨時佔位用。'
                    });
                }
            }
        });

        let levelQuestions = QUESTION_BANK[nodeCode][currentLevel];
        levelQuestions = [...levelQuestions].sort(() => 0.5 - Math.random());
        finalQuestions = levelQuestions.slice(0, 5);
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
    document.getElementById('question-number').textContent = `第 ${currentQuestionIndex + 1} / ${currentQuestions.length} 題`;
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

            // 解析邏輯 (更具彈性的新版 ODS MultiIndex 格式)
            const newMapping = {};
            
            // 找出包含標題的列 (前 3 列)
            const headerRow0 = jsonData[0] || []; 
            const headerRow2 = jsonData[2] || []; 
            
            const rateColIndices = [];
            const colToNodeCode = {};

            // 掃描表頭，精準抓取「節點總結」欄位
            for (let j = 0; j < Math.max(headerRow0.length, headerRow2.length); j++) {
                const cell0 = String(headerRow0[j] || "").trim();
                const cell2 = String(headerRow2[j] || "").trim();
                
                // 只看「第一列有寫內容」的欄位
                if (cell0 !== "" && cell0 !== "undefined" && cell0 !== "學生" && cell0 !== "完成率") {
                    let nodeCode = cell0.split(' ')[0].toUpperCase();
                    
                    // 關鍵過濾：必須包含「-」才是節點，且該欄位的第三列必須是「答對率」
                    if (nodeCode.includes('-') && cell2.includes('答對率')) {
                        const desc = cell0.split(' ').slice(1).join(' ').trim() || nodeCode;
                        
                        // 紀錄節點描述
                        if (typeof window.NODES_DESCRIPTIONS !== 'undefined') {
                             window.NODES_DESCRIPTIONS[nodeCode] = desc;
                        }

                        rateColIndices.push(j);
                        colToNodeCode[j] = nodeCode;
                        console.log(`✅ 成功鎖定節點總結欄位: [第 ${j} 欄] 代碼: ${nodeCode}`);
                    }
                }
            }

            // 從第 4 列開始讀取學生資料
            let fallbackId = 1;
            for (let i = 3; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0) continue;

                // 姓名位於第一欄
                let nameStr = String(row[0] || "").trim();
                if (!nameStr || nameStr === 'undefined' || nameStr === '') continue;

                // 彈性解析 ID (年級 + 座號2碼格式，例如 502) 和姓名
                let id = String(fallbackId);
                let name = nameStr;
                
                const matchGrade = nameStr.match(/(\d+)年/);
                const matchNum = nameStr.match(/(\d+)號/);

                if (matchNum) {
                    let numStr = matchNum[1].padStart(2, '0');
                    if (matchGrade) {
                        id = matchGrade[1] + numStr; // 例如 "5" + "02" = "502"
                    } else {
                        id = numStr; // 若無年級則至少保留兩碼 "02"
                    }
                    // 去除 "x號" 等前綴保留姓名
                    name = nameStr.replace(/.*?(\d+)號\s*/, '').trim(); 
                } else if (nameStr.match(/^\d+/)) {
                     // 若開頭是純數字例如 "5 林小明" 但沒寫「號」字
                     let numRaw = nameStr.match(/^(\d+)/)[1];
                     id = matchGrade ? matchGrade[1] + numRaw.padStart(2, '0') : numRaw.padStart(2, '0');
                     name = nameStr.replace(/^\d+\s*/, '').trim();
                } else {
                    fallbackId++;
                }
                
                if (name === "") name = nameStr; // 如果切完變空的，保留原狀

                const weakNodes = [];
                for (let colIdx of rateColIndices) {
                    let cellVal = String(row[colIdx] !== undefined ? row[colIdx] : "").trim();
                    
                    if (cellVal === "" || cellVal === "-") continue; // 略過無效格子

                    let numericVal = parseFloat(cellVal.replace('%', ''));

                    // 依據規則：答對率100就不列為弱點，答對率0才需要列為弱點
                    if (!isNaN(numericVal) && numericVal === 0) {
                        weakNodes.push(colToNodeCode[colIdx]);
                    }
                }


                newMapping[id] = {
                    name: name,
                    fullName: nameStr,
                    weakNodes: [...new Set(weakNodes)] // 去除重複
                };
            }

            // 更新本地與全域狀態 (區分老師)
            localStorage.setItem(`custom_mapping_${currentTeacherId}`, JSON.stringify(newMapping));
            customMapping = newMapping;

            status.textContent = `🔄 正在為教師 [${currentTeacherId}] 清理舊資料並同步新名單...`;
            
            // 清空雲端的舊有資料 (包含該老師名下舊名單、進度、日誌)
            await DatabaseService.clearAllDataForNewUpload(currentTeacherId);

            // 同步新名單至雲端
            await DatabaseService.syncStudents(newMapping, currentTeacherId);

            status.textContent = "✅ 名單更新成功！(舊進度已清除)";
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

init();
