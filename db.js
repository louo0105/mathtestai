/**
 * Supabase 雲端資料庫串接服務
 */

// 請在此處輸入您的 Supabase 專案網址與 API 金鑰 (anon public)
const SUPABASE_URL = 'https://nrgasojgdittkjjdaenq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fAhlNjD3GzLkTXIdoG-qgg_DcMsTMgc';

let supabaseClient = null;

// 初始化 Supabase
function initSupabase() {
    if (typeof supabase === 'undefined') {
        console.error('Supabase SDK 未載入');
        return null;
    }
    if (SUPABASE_URL === 'https://YOUR_PROJECT_ID.supabase.co') {
        console.warn('請設定正確的 SUPABASE_URL 與 SUPABASE_KEY 以啟用雲端同步功能。');
        return null;
    }
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return supabaseClient;
}

const DatabaseService = {
    // 獲取學生完整資料 (含弱點)
    async getStudent(id) {
        if (!supabaseClient) return null;
        const { data, error } = await supabaseClient
            .from('students')
            .select('*')
            .eq('id', id)
            .single();
        if (error) {
            console.error('獲取學生失敗:', error);
            return null;
        }
        return data;
    },

    // 獲取該學生的所有練習進度
    async getProgress(studentId) {
        if (!supabaseClient) return {};
        const { data, error } = await supabaseClient
            .from('practice_progress')
            .select('*')
            .eq('student_id', studentId);
        
        if (error) return {};
        
        const progressObj = {};
        data.forEach(item => {
            progressObj[`${item.node_code}_${item.level}`] = item.is_completed;
            progressObj[`${item.node_code}_${item.level}_score`] = item.last_score;
        });
        return progressObj;
    },

    // 更新練習進度與紀錄
    async saveQuizResult(studentId, name, node, level, score, total, duration) {
        if (!supabaseClient) return;

        const accuracy = Math.round((score / total) * 100) + '%';
        const scoreStr = `${score}/${total}`;

        // 1. 更新摘要進度 (Upsert)
        const { error: progError } = await supabaseClient
            .from('practice_progress')
            .upsert({
                student_id: studentId,
                node_code: node,
                level: level,
                is_completed: true,
                last_score: scoreStr,
                updated_at: new Date()
            }, { onConflict: 'student_id,node_code,level' });

        if (progError) console.error('更新摘要失敗:', progError);

        // 2. 存入詳細 Log
        const { error: logError } = await supabaseClient
            .from('quiz_logs')
            .insert([{
                student_id: studentId,
                name: name,
                node_code: node,
                level: level,
                score: scoreStr,
                accuracy: accuracy,
                duration: duration,
                created_at: new Date()
            }]);

        if (logError) {
            console.error('寫入 Log 失敗:', logError);
            alert('⚠️ 雲端紀錄傳送失敗！這可能是 RLS 設定或是網路連線問題。');
            return false;
        }
        return true;
    },

    // 教師端：獲取所有學生名單
    async getAllStudents() {
        if (!supabaseClient) return [];
        const { data, error } = await supabaseClient
            .from('students')
            .select('*');
        return error ? [] : data;
    },

    // 教師端：獲取所有學生的進度統計
    async getAllProgress() {
        if (!supabaseClient) return [];
        const { data, error } = await supabaseClient
            .from('practice_progress')
            .select('*');
        return error ? [] : data;
    },

    // 教師端：獲取所有活動紀錄 (限前 100 筆)
    async getAllLogs() {
        if (!supabaseClient) return [];
        const { data, error } = await supabaseClient
            .from('quiz_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
        return error ? [] : data;
    },

    // 教師端：上傳/更新學生名單與弱點
    async syncStudents(mapping) {
        if (!supabaseClient) {
            console.error('Supabase 未初始化');
            return;
        }
        const studentData = Object.keys(mapping).map(id => ({
            id: id,
            name: mapping[id].name,
            weak_nodes: mapping[id].weakNodes
        }));

        const { error } = await supabaseClient
            .from('students')
            .upsert(studentData, { onConflict: 'id' });
        
        if (error) {
            console.error('同步學生名單失敗:', error);
            alert('雲端同步失敗！請確認 Supabase 的 CORS 設定包含 http://localhost:8080\n錯誤訊息: ' + error.message);
        } else {
            console.log('雲端名單同步成功');
            alert('✅ 雲端名單與進度已成功初始化！');
        }
    },

    // 清空日誌 (老師用)
    async clearAllLogs() {
        if (!supabaseClient) return;
        // 注意：Supabase Delete 需要 RLS/或是沒有條件
        const { error } = await supabaseClient
            .from('quiz_logs')
            .delete()
            .neq('student_id', ''); // 刪除所有
        
        if (error) console.error('清空紀錄失敗:', error);
    },

    // 上傳新檔案時清空舊有所有的資料 (名單、進度、日誌)
    async clearAllDataForNewUpload() {
        if (!supabaseClient) return;
        console.log("Cleaning old database records...");
        await supabaseClient.from('practice_progress').delete().neq('student_id', '');
        await supabaseClient.from('quiz_logs').delete().neq('student_id', '');
        await supabaseClient.from('students').delete().neq('id', '');
    },

    // --- AI 擴充功能 ---

    // 獲取全域系統設定 (例如 AI 模式開關)
    async getSystemSettings() {
        if (!supabaseClient) return { ai_mode: false };
        const { data, error } = await supabaseClient
            .from('app_settings')
            .select('*')
            .eq('id', 'global')
            .single();
        
        if (error) {
            console.warn('獲取設定失敗，使用預設值:', error);
            return { ai_mode: false };
        }
        return data;
    },

    // 更新系統設定 (老師用)
    async updateSystemSettings(aiMode) {
        if (!supabaseClient) return false;
        const { error } = await supabaseClient
            .from('app_settings')
            .upsert({ id: 'global', ai_mode: aiMode });
        
        if (error) {
            console.error('更新設定失敗:', error);
            return false;
        }
        return true;
    },

    // 呼叫雲端函數生成題目
    async generateAIQuestions(nodeCode, description, level) {
        if (!supabaseClient) return null;
        try {
            const { data, error } = await supabaseClient.functions.invoke('ai-question-generator', {
                body: { nodeCode, level, description }
            });

            if (error) throw error;
            return data;
        } catch (err) {
            console.error('AI 出題失敗:', err);
            return null;
        }
    }
};

// 嘗試初始化
initSupabase();
