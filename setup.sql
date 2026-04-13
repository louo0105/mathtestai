-- 🏮 線上 AI 出題系統：初始化指令  Lantern
-- 請在 Supabase 的 SQL Editor 中貼上以下指令並執行

-- 1. 建立系統設定資料表
CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY,
    ai_mode BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 插入初始資料 (若不存在)
INSERT INTO app_settings (id, ai_mode) 
VALUES 
    ('admin', FALSE),
    ('admin3', FALSE),
    ('admin4', FALSE),
    ('admin6', FALSE)
ON CONFLICT (id) DO NOTHING;

-- 3. 設定權限 (RLS)
-- 讓所有人都能讀取設定
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-only access to app_settings"
ON app_settings FOR SELECT
USING (true);

-- 僅允許老師 (或通過特定金鑰) 修改設定 (此處簡化為允許，實務上可根據需要加強)
CREATE POLICY "Allow all for authenticated/public for demo"
ON app_settings FOR ALL
USING (true);

-- 4. 🏮 新增多教師支援 (Teacher ID 欄位)
ALTER TABLE students ADD COLUMN IF NOT EXISTS teacher_id TEXT DEFAULT 'admin';
ALTER TABLE practice_progress ADD COLUMN IF NOT EXISTS teacher_id TEXT DEFAULT 'admin';
ALTER TABLE quiz_logs ADD COLUMN IF NOT EXISTS teacher_id TEXT DEFAULT 'admin';

-- 🏮 學生與進度表的調整 (確保 RLS 開放)
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Student Access" ON students FOR ALL USING (true);

ALTER TABLE practice_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Progress Access" ON practice_progress FOR ALL USING (true);

ALTER TABLE quiz_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Logs Access" ON quiz_logs FOR ALL USING (true);
