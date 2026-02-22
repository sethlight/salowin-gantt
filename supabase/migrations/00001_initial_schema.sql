-- =============================================================
-- SALOWIN Gantt Chart - Supabase Schema
-- =============================================================

-- 0. UUID生成拡張
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- 1. PROFILES テーブル (auth.usersのミラー)
-- =============================================================
CREATE TABLE public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  display_name TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =============================================================
-- 2. PROJECTS テーブル
-- =============================================================
CREATE TABLE public.projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  owner_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- 3. PROJECT_MEMBERS テーブル (アクセス制御)
-- =============================================================
CREATE TYPE public.member_role AS ENUM ('owner', 'editor', 'viewer');

CREATE TABLE public.project_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        public.member_role NOT NULL DEFAULT 'viewer',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- 4. TASKS テーブル
-- =============================================================
CREATE TABLE public.tasks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  row_id      TEXT NOT NULL,
  sort_order  INTEGER NOT NULL,
  level       INTEGER NOT NULL DEFAULT 0,
  collapsed   BOOLEAN NOT NULL DEFAULT false,
  text        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT '未着手',
  progress    INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  manager     TEXT NOT NULL DEFAULT '',
  ball        TEXT NOT NULL DEFAULT '',
  start_date  TEXT DEFAULT '',
  end_date    TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES public.profiles(id),
  UNIQUE(project_id, row_id)
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- 5. NOTES テーブル (Quillリッチテキスト、タスクごと1つ)
-- =============================================================
CREATE TABLE public.notes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  row_id      TEXT NOT NULL,
  title       TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES public.profiles(id),
  UNIQUE(project_id, row_id)
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- 6. COMMENTS テーブル
-- =============================================================
CREATE TABLE public.comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  row_id      TEXT NOT NULL,
  author_id   UUID NOT NULL REFERENCES public.profiles(id),
  author_email TEXT NOT NULL,
  body        TEXT NOT NULL,
  cleared     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- 7. PROJECT_SETTINGS テーブル
-- =============================================================
CREATE TABLE public.project_settings (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id         UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  chatwork_room_id   TEXT DEFAULT '',
  chatwork_api_token TEXT DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_settings ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- ヘルパー関数: プロジェクトメンバーシップチェック
-- =============================================================
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_editor(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
      AND role IN ('owner', 'editor')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
      AND role = 'owner'
  );
$$;

-- =============================================================
-- RLS Policies: PROJECTS
-- =============================================================
CREATE POLICY "projects_select_member"
  ON public.projects FOR SELECT TO authenticated
  USING (public.is_project_member(id));

CREATE POLICY "projects_insert_authenticated"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "projects_update_owner"
  ON public.projects FOR UPDATE TO authenticated
  USING (public.is_project_owner(id))
  WITH CHECK (public.is_project_owner(id));

CREATE POLICY "projects_delete_owner"
  ON public.projects FOR DELETE TO authenticated
  USING (public.is_project_owner(id));

-- =============================================================
-- RLS Policies: PROJECT_MEMBERS
-- =============================================================
CREATE POLICY "members_select_member"
  ON public.project_members FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "members_insert_owner"
  ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY "members_update_owner"
  ON public.project_members FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY "members_delete_owner"
  ON public.project_members FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- =============================================================
-- RLS Policies: TASKS
-- =============================================================
CREATE POLICY "tasks_select_member"
  ON public.tasks FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "tasks_insert_editor"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_project_editor(project_id));

CREATE POLICY "tasks_update_editor"
  ON public.tasks FOR UPDATE TO authenticated
  USING (public.is_project_editor(project_id));

CREATE POLICY "tasks_delete_editor"
  ON public.tasks FOR DELETE TO authenticated
  USING (public.is_project_editor(project_id));

-- =============================================================
-- RLS Policies: NOTES
-- =============================================================
CREATE POLICY "notes_select_member"
  ON public.notes FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "notes_insert_editor"
  ON public.notes FOR INSERT TO authenticated
  WITH CHECK (public.is_project_editor(project_id));

CREATE POLICY "notes_update_editor"
  ON public.notes FOR UPDATE TO authenticated
  USING (public.is_project_editor(project_id));

CREATE POLICY "notes_delete_editor"
  ON public.notes FOR DELETE TO authenticated
  USING (public.is_project_editor(project_id));

-- =============================================================
-- RLS Policies: COMMENTS
-- =============================================================
CREATE POLICY "comments_select_member"
  ON public.comments FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "comments_insert_editor"
  ON public.comments FOR INSERT TO authenticated
  WITH CHECK (public.is_project_editor(project_id));

CREATE POLICY "comments_update_editor"
  ON public.comments FOR UPDATE TO authenticated
  USING (public.is_project_editor(project_id));

CREATE POLICY "comments_delete_author_or_owner"
  ON public.comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_project_owner(project_id));

-- =============================================================
-- RLS Policies: PROJECT_SETTINGS
-- =============================================================
CREATE POLICY "settings_select_member"
  ON public.project_settings FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "settings_insert_owner"
  ON public.project_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY "settings_update_owner"
  ON public.project_settings FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id));

-- =============================================================
-- インデックス
-- =============================================================
CREATE INDEX idx_project_members_lookup ON public.project_members(project_id, user_id);
CREATE INDEX idx_project_members_user ON public.project_members(user_id);
CREATE INDEX idx_tasks_project_sort ON public.tasks(project_id, sort_order);
CREATE INDEX idx_tasks_project_row ON public.tasks(project_id, row_id);
CREATE INDEX idx_notes_project_row ON public.notes(project_id, row_id);
CREATE INDEX idx_comments_project_row ON public.comments(project_id, row_id);
CREATE INDEX idx_comments_created ON public.comments(created_at DESC);

-- =============================================================
-- Realtime有効化
-- =============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_members;

-- =============================================================
-- トリガー: ユーザー登録時にprofiles自動作成
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================
-- トリガー: プロジェクト作成時にownerをメンバーに自動追加
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');

  INSERT INTO public.project_settings (project_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();

-- =============================================================
-- トリガー: updated_at自動更新
-- =============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_notes_updated_at BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_settings_updated_at BEFORE UPDATE ON public.project_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================
-- RPC: タスク並び替え (アトミック)
-- =============================================================
CREATE OR REPLACE FUNCTION public.reorder_tasks(
  p_project_id UUID,
  p_task_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  i INTEGER;
BEGIN
  IF NOT public.is_project_editor(p_project_id) THEN
    RAISE EXCEPTION 'Not authorized to reorder tasks in this project';
  END IF;

  FOR i IN 1..array_length(p_task_ids, 1) LOOP
    UPDATE public.tasks
    SET sort_order = i, updated_at = now()
    WHERE id = p_task_ids[i] AND project_id = p_project_id;
  END LOOP;
END;
$$;

-- =============================================================
-- RPC: メールアドレスからユーザーを検索 (メンバー招待用)
-- =============================================================
CREATE OR REPLACE FUNCTION public.find_user_by_email(p_email TEXT)
RETURNS TABLE(id UUID, email TEXT, display_name TEXT)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT id, email, display_name
  FROM public.profiles
  WHERE email = p_email
  LIMIT 1;
$$;
