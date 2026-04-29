-- =============================================================================
-- Today Board / Room List setup
-- Run in Supabase SQL Editor after setup-production.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.hotel_room_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id text NOT NULL,
  room_number text NOT NULL,
  room_type text,
  sort_order int4 NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, room_number)
);

CREATE INDEX IF NOT EXISTS hotel_room_templates_hotel_sort_idx
  ON public.hotel_room_templates (hotel_id, sort_order);

CREATE TABLE IF NOT EXISTS public.room_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id text NOT NULL,
  report_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'printed')),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  shift_start time,
  checker_name text,
  cleaner_names text,
  list_name text,
  abreise_total int4 NOT NULL DEFAULT 0,
  bleibe_total int4 NOT NULL DEFAULT 0,
  preview_image_url text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, report_date, list_name)
);

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

CREATE INDEX IF NOT EXISTS room_lists_hotel_date_idx
  ON public.room_lists (hotel_id, report_date DESC);

CREATE TABLE IF NOT EXISTS public.room_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_list_id uuid NOT NULL REFERENCES public.room_lists (id) ON DELETE CASCADE,
  room_number text NOT NULL,
  assignment_type text NOT NULL DEFAULT 'none'
    CHECK (assignment_type IN ('none', 'abreise', 'anreise', 'bleibe')),
  cleaner_name text,
  note text,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_list_id, room_number)
);

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

CREATE INDEX IF NOT EXISTS room_list_items_list_idx
  ON public.room_list_items (room_list_id);

ALTER TABLE public.hotel_room_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel_directory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reinigung_room_templates_select" ON public.hotel_room_templates;
DROP POLICY IF EXISTS "reinigung_room_templates_write" ON public.hotel_room_templates;
DROP POLICY IF EXISTS "reinigung_room_lists_select" ON public.room_lists;
DROP POLICY IF EXISTS "reinigung_room_lists_write" ON public.room_lists;
DROP POLICY IF EXISTS "reinigung_room_list_items_select" ON public.room_list_items;
DROP POLICY IF EXISTS "reinigung_room_list_items_write" ON public.room_list_items;
DROP POLICY IF EXISTS "reinigung_personnel_directory_select" ON public.personnel_directory;
DROP POLICY IF EXISTS "reinigung_personnel_directory_write" ON public.personnel_directory;

CREATE POLICY "reinigung_room_templates_select" ON public.hotel_room_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role IN ('admin', 'patron') OR p.hotel_id = hotel_room_templates.hotel_id)
    )
  );

CREATE POLICY "reinigung_room_templates_write" ON public.hotel_room_templates
  FOR ALL TO authenticated
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

CREATE POLICY "reinigung_room_lists_select" ON public.room_lists
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role IN ('admin', 'patron') OR p.hotel_id = room_lists.hotel_id)
    )
  );

CREATE POLICY "reinigung_room_lists_write" ON public.room_lists
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role IN ('admin', 'patron') OR p.hotel_id = room_lists.hotel_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role IN ('admin', 'patron') OR p.hotel_id = room_lists.hotel_id)
    )
  );

CREATE POLICY "reinigung_room_list_items_select" ON public.room_list_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.room_lists rl
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE rl.id = room_list_items.room_list_id
        AND (p.role IN ('admin', 'patron') OR p.hotel_id = rl.hotel_id)
    )
  );

CREATE POLICY "reinigung_room_list_items_write" ON public.room_list_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.room_lists rl
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE rl.id = room_list_items.room_list_id
        AND (p.role IN ('admin', 'patron') OR p.hotel_id = rl.hotel_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.room_lists rl
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE rl.id = room_list_items.room_list_id
        AND (p.role IN ('admin', 'patron') OR p.hotel_id = rl.hotel_id)
    )
  );

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

-- Optional seed based on provided Dreiburgensee list.
-- IMPORTANT: App catalog id for Das Dreiburgenseehotel is 'DBS'.
INSERT INTO public.hotel_room_templates (hotel_id, room_number, room_type, sort_order)
VALUES
  ('DBS', '001', NULL, 1),
  ('dreiburgensee', '002', NULL, 2),
  ('dreiburgensee', '003', NULL, 3),
  ('dreiburgensee', '004', NULL, 4),
  ('dreiburgensee', '005', 'Suit', 5),
  ('dreiburgensee', '006', 'FU1', 6),
  ('dreiburgensee', '007', 'FU1', 7),
  ('dreiburgensee', '008', 'FU2', 8),
  ('dreiburgensee', '009', 'FU2', 9),
  ('dreiburgensee', '010', NULL, 10),
  ('dreiburgensee', '011', NULL, 11),
  ('dreiburgensee', '012', NULL, 12),
  ('dreiburgensee', '014', NULL, 14),
  ('dreiburgensee', '015', NULL, 15),
  ('dreiburgensee', '016', NULL, 16),
  ('dreiburgensee', '017', NULL, 17),
  ('dreiburgensee', '018', NULL, 18),
  ('dreiburgensee', '019', NULL, 19),
  ('dreiburgensee', '020', NULL, 20),
  ('dreiburgensee', '101', NULL, 101),
  ('dreiburgensee', '102', NULL, 102),
  ('dreiburgensee', '103', NULL, 103),
  ('dreiburgensee', '104', NULL, 104),
  ('dreiburgensee', '105', NULL, 105),
  ('dreiburgensee', '106', NULL, 106),
  ('dreiburgensee', '107', NULL, 107),
  ('dreiburgensee', '108', NULL, 108),
  ('dreiburgensee', '109', 'Suit', 109),
  ('dreiburgensee', '110', 'FU3', 110),
  ('dreiburgensee', '111', 'FU3', 111),
  ('dreiburgensee', '112', 'FU4', 112),
  ('dreiburgensee', '114', 'FU4', 114),
  ('dreiburgensee', '115', 'FU5', 115),
  ('dreiburgensee', '116', 'FU5', 116),
  ('dreiburgensee', '117', 'FU6', 117),
  ('dreiburgensee', '118', 'FU6', 118),
  ('dreiburgensee', '119', 'FU7', 119),
  ('dreiburgensee', '120', 'FU7', 120),
  ('dreiburgensee', '121', 'FU8', 121),
  ('dreiburgensee', '122', 'FU8', 122),
  ('dreiburgensee', '123', 'FU9', 123),
  ('dreiburgensee', '124', 'FU9', 124),
  ('dreiburgensee', '125', NULL, 125),
  ('dreiburgensee', '126', NULL, 126),
  ('dreiburgensee', '127', NULL, 127),
  ('dreiburgensee', '128', NULL, 128),
  ('dreiburgensee', '201', NULL, 201),
  ('dreiburgensee', '202', NULL, 202),
  ('dreiburgensee', '203', NULL, 203),
  ('dreiburgensee', '204', NULL, 204),
  ('dreiburgensee', '205', NULL, 205),
  ('dreiburgensee', '206', NULL, 206),
  ('dreiburgensee', '207', NULL, 207),
  ('dreiburgensee', '208', NULL, 208),
  ('dreiburgensee', '209', 'Suit', 209),
  ('dreiburgensee', '210', 'FU10', 210),
  ('dreiburgensee', '211', 'FU10', 211),
  ('dreiburgensee', '212', NULL, 212),
  ('dreiburgensee', '214', NULL, 214),
  ('dreiburgensee', '215', NULL, 215),
  ('dreiburgensee', '216', NULL, 216),
  ('dreiburgensee', '217', NULL, 217),
  ('dreiburgensee', '218', NULL, 218),
  ('dreiburgensee', '219', NULL, 219),
  ('dreiburgensee', '220', NULL, 220),
  ('dreiburgensee', '221', NULL, 221),
  ('dreiburgensee', '222', NULL, 222),
  ('dreiburgensee', '223', NULL, 223),
  ('dreiburgensee', '224', NULL, 224),
  ('dreiburgensee', '225', NULL, 225),
  ('dreiburgensee', '226', NULL, 226),
  ('dreiburgensee', '227', NULL, 227),
  ('dreiburgensee', '228', NULL, 228),
  ('dreiburgensee', '301', NULL, 301),
  ('dreiburgensee', '302', NULL, 302),
  ('dreiburgensee', '303', NULL, 303),
  ('dreiburgensee', '304', NULL, 304),
  ('dreiburgensee', '305', NULL, 305),
  ('dreiburgensee', '306', NULL, 306),
  ('dreiburgensee', '307', NULL, 307),
  ('dreiburgensee', '308', NULL, 308),
  ('dreiburgensee', '309', 'Suit', 309),
  ('dreiburgensee', '310', 'FU11', 310),
  ('dreiburgensee', '311', 'FU11', 311),
  ('dreiburgensee', '312', NULL, 312),
  ('dreiburgensee', '314', NULL, 314),
  ('dreiburgensee', '315', NULL, 315),
  ('dreiburgensee', '316', NULL, 316),
  ('dreiburgensee', '317', NULL, 317),
  ('dreiburgensee', '318', NULL, 318),
  ('dreiburgensee', '319', NULL, 319),
  ('dreiburgensee', '320', NULL, 320),
  ('dreiburgensee', '321', NULL, 321),
  ('dreiburgensee', '322', NULL, 322),
  ('dreiburgensee', '323', NULL, 323),
  ('dreiburgensee', '324', NULL, 324),
  ('dreiburgensee', '325', NULL, 325),
  ('dreiburgensee', '326', NULL, 326),
  ('dreiburgensee', '327', NULL, 327),
  ('dreiburgensee', '328', NULL, 328),
  ('dreiburgensee', '405', NULL, 405),
  ('dreiburgensee', '406', NULL, 406),
  ('dreiburgensee', '407', NULL, 407),
  ('dreiburgensee', '408', NULL, 408),
  ('dreiburgensee', '409', NULL, 409),
  ('dreiburgensee', '410', NULL, 410),
  ('dreiburgensee', '411', NULL, 411),
  ('dreiburgensee', '412', NULL, 412),
  ('dreiburgensee', '413', NULL, 413),
  ('dreiburgensee', '414', NULL, 414),
  ('dreiburgensee', '415', NULL, 415),
  ('dreiburgensee', '416', NULL, 416),
  ('dreiburgensee', '417', NULL, 417),
  ('dreiburgensee', '418', NULL, 418),
  ('dreiburgensee', '419', NULL, 419),
  ('dreiburgensee', '420', NULL, 420),
  ('dreiburgensee', '421', NULL, 421),
  ('dreiburgensee', '422', NULL, 422),
  ('dreiburgensee', '423', NULL, 423),
  ('dreiburgensee', '424', NULL, 424),
  ('dreiburgensee', '425', NULL, 425),
  ('dreiburgensee', '426', NULL, 426),
  ('dreiburgensee', '427', NULL, 427),
  ('dreiburgensee', '428', NULL, 428),
  ('dreiburgensee', '429', NULL, 429),
  ('dreiburgensee', '430', NULL, 430),
  ('DBS', '431', NULL, 431)
ON CONFLICT (hotel_id, room_number) DO UPDATE SET
  room_type = EXCLUDED.room_type,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

-- Backward compatibility for older seeds that used text hotel ids.
-- Merge old ids into DBS without violating unique (hotel_id, room_number).
INSERT INTO public.hotel_room_templates (hotel_id, room_number, room_type, sort_order, is_active)
SELECT
  'DBS' AS hotel_id,
  room_number,
  room_type,
  sort_order,
  is_active
FROM public.hotel_room_templates
WHERE hotel_id IN ('dreiburgensee', 'Das Dreiburgenseehotel', 'das dreiburgenseehotel')
ON CONFLICT (hotel_id, room_number) DO UPDATE SET
  room_type = EXCLUDED.room_type,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

DELETE FROM public.hotel_room_templates
WHERE hotel_id IN ('dreiburgensee', 'Das Dreiburgenseehotel', 'das dreiburgenseehotel');

INSERT INTO public.personnel_directory (hotel_id, staff_no, name, role_label, is_active)
VALUES
  ('DBS', 'P-101', 'Sedat', 'Cleaner', true),
  ('DBS', 'P-102', 'Aylin', 'Cleaner', true),
  ('DBS', 'P-103', 'Elif', 'Cleaner', true),
  ('DBS', 'P-104', 'Murat', 'Checker', true),
  ('DBS', 'P-105', 'Samet', 'Cleaner', true),
  ('DBS', 'P-106', 'Yulia', 'Cleaner', true)
ON CONFLICT (hotel_id, name) DO UPDATE SET
  staff_no = EXCLUDED.staff_no,
  role_label = EXCLUDED.role_label,
  is_active = EXCLUDED.is_active;
