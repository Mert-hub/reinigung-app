-- =============================================================================
-- Task Management: ops_tasks, task_chat_messages, task_proposals + RLS
-- Supabase SQL Editor'da calistirin (setup-production.sql sonrasi).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) ops_tasks — admin atar; vorarbeiter kendi gorevlerini gorur / durum gunceller
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ops_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  hotel_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  deadline_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled')),
  assignee_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_tasks_assignee_starts ON public.ops_tasks (assignee_id, starts_at);
CREATE INDEX IF NOT EXISTS ops_tasks_deadline ON public.ops_tasks (deadline_at);

ALTER TABLE public.ops_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reinigung_ops_tasks_select" ON public.ops_tasks;
DROP POLICY IF EXISTS "reinigung_ops_tasks_insert" ON public.ops_tasks;
DROP POLICY IF EXISTS "reinigung_ops_tasks_update" ON public.ops_tasks;
DROP POLICY IF EXISTS "reinigung_ops_tasks_delete" ON public.ops_tasks;

CREATE POLICY "reinigung_ops_tasks_select" ON public.ops_tasks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('admin', 'patron')
          OR ops_tasks.assignee_id = p.id
        )
    )
  );

CREATE POLICY "reinigung_ops_tasks_insert" ON public.ops_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'patron')
    )
  );

CREATE POLICY "reinigung_ops_tasks_update" ON public.ops_tasks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('admin', 'patron')
          OR ops_tasks.assignee_id = p.id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('admin', 'patron')
          OR ops_tasks.assignee_id = p.id
        )
    )
  );

CREATE POLICY "reinigung_ops_tasks_delete" ON public.ops_tasks
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'patron')
    )
  );

-- ---------------------------------------------------------------------------
-- 2) task_chat_messages — grup sohbeti
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_chat_messages_created ON public.task_chat_messages (created_at DESC);

ALTER TABLE public.task_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reinigung_task_chat_select" ON public.task_chat_messages;
DROP POLICY IF EXISTS "reinigung_task_chat_insert" ON public.task_chat_messages;

CREATE POLICY "reinigung_task_chat_select" ON public.task_chat_messages
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "reinigung_task_chat_insert" ON public.task_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3) task_proposals — oneri; admin onaylar / reddeder
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  hotel_id text,
  suggested_starts_at timestamptz,
  suggested_ends_at timestamptz,
  suggested_deadline_at timestamptz,
  proposed_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_proposals_status ON public.task_proposals (status, created_at DESC);

ALTER TABLE public.task_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reinigung_task_proposals_select" ON public.task_proposals;
DROP POLICY IF EXISTS "reinigung_task_proposals_insert" ON public.task_proposals;
DROP POLICY IF EXISTS "reinigung_task_proposals_update" ON public.task_proposals;

CREATE POLICY "reinigung_task_proposals_select" ON public.task_proposals
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "reinigung_task_proposals_insert" ON public.task_proposals
  FOR INSERT TO authenticated
  WITH CHECK (proposed_by = auth.uid());

CREATE POLICY "reinigung_task_proposals_update" ON public.task_proposals
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'patron')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'patron')
    )
  );

-- Calendar UI color (lavender, sage, peacock, …). Idempotent on existing DBs.
ALTER TABLE public.ops_tasks ADD COLUMN IF NOT EXISTS calendar_color text;
