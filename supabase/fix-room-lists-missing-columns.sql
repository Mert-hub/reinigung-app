-- Patch existing DBs that created room_lists before latest schema updates.

ALTER TABLE public.room_lists
  ADD COLUMN IF NOT EXISTS shift_start time,
  ADD COLUMN IF NOT EXISTS checker_name text,
  ADD COLUMN IF NOT EXISTS cleaner_names text,
  ADD COLUMN IF NOT EXISTS list_name text,
  ADD COLUMN IF NOT EXISTS abreise_total int4 NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bleibe_total int4 NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preview_image_url text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'room_lists_hotel_id_report_date_key'
      AND conrelid = 'public.room_lists'::regclass
  ) THEN
    ALTER TABLE public.room_lists DROP CONSTRAINT room_lists_hotel_id_report_date_key;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS room_lists_hotel_date_name_key
  ON public.room_lists (hotel_id, report_date, COALESCE(list_name, ''));

UPDATE public.room_lists
SET list_name = checker_name
WHERE (list_name IS NULL OR btrim(list_name) = '')
  AND checker_name IS NOT NULL
  AND btrim(checker_name) <> '';

CREATE TABLE IF NOT EXISTS public.personnel_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id text NOT NULL,
  staff_no text,
  name text NOT NULL,
  role_label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, name)
);

CREATE INDEX IF NOT EXISTS personnel_directory_hotel_idx
  ON public.personnel_directory (hotel_id, name);

ALTER TABLE public.personnel_directory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reinigung_personnel_directory_select" ON public.personnel_directory;
DROP POLICY IF EXISTS "reinigung_personnel_directory_write" ON public.personnel_directory;

CREATE POLICY "reinigung_personnel_directory_select" ON public.personnel_directory
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role IN ('admin', 'patron') OR p.hotel_id = personnel_directory.hotel_id)
    )
  );

CREATE POLICY "reinigung_personnel_directory_write" ON public.personnel_directory
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role IN ('admin', 'patron') OR p.hotel_id = personnel_directory.hotel_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role IN ('admin', 'patron') OR p.hotel_id = personnel_directory.hotel_id)
    )
  );
