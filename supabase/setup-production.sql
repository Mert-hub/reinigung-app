-- =============================================================================
-- Umut / reinigung-app — Supabase kurulumu (SQL Editor: tek seferde veya bölüm bölüm)
-- Bu dosya: (1) pms_forecasts sütunları, (2) RLS, (3) room-list storage
-- Hata alirsaniz: hata satirindaki bölümü yorum satiri yapin veya sira ile calistirin.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) pms_forecasts: uygulamanin kullandigi eksik sütunlar
--    (forecast-module.tsx: total_occupancy, user_id)
-- ---------------------------------------------------------------------------
ALTER TABLE public.pms_forecasts
  ADD COLUMN IF NOT EXISTS total_occupancy int4,
  ADD COLUMN IF NOT EXISTS user_id uuid;

COMMENT ON COLUMN public.pms_forecasts.total_occupancy IS 'Geschaetzte / erwartete Belegung (recharts, Forecast UI)';
COMMENT ON COLUMN public.pms_forecasts.user_id IS 'Wer zuletzt gespeichert hat (auth.users)';

-- Optional FK: auth.users var; yoksa bu satir hata verirse sadece COMMENT kalir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pms_forecasts_user_id_fkey'
  ) THEN
    ALTER TABLE public.pms_forecasts
      ADD CONSTRAINT pms_forecasts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'user_id foreign key atlandi: %', SQLERRM;
END;
$$;

-- (hotel_id, forecast_date) tekilligi: ayni cifti iki kez ekleme riskine karsi istege bagli:
--   supabase/optional-unique-forecast.sql dosyasini yinelenenler temizlendikten sonra calistirin.
-- Realtime publish UPDATE kullaniminda 55000 hatasini onlemek icin replica identity gereklidir.
ALTER TABLE public.pms_forecasts REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------------------
-- 2) profiles: recursion-safe SELECT policy
-- Not: onceki policy profiles icinde tekrar profiles sorguladigi icin
-- "infinite recursion detected in policy for relation profiles" hatasi uretebilir.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reinigung_profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "reinigung_profiles_select" ON public.profiles;
CREATE POLICY "reinigung_profiles_select" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- (Opsiyonel) kendi profilini güncellemek: ihtiyaca göre açin
-- DROP POLICY IF EXISTS "reinigung_profiles_update_own" ON public.profiles;
-- CREATE POLICY "reinigung_profiles_update_own" ON public.profiles
--   FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3) daily_reports: RLS
--    Vorarbeiter: sadece kendi hotel_id; admin/patron: tum oteller
--    (getUserProfile: admin, patron => admin, diger => vorarbeiter)
-- ---------------------------------------------------------------------------
ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS public_count int4,
  ADD COLUMN IF NOT EXISTS spuler_count int4;

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reinigung_daily_reports_select" ON public.daily_reports;
DROP POLICY IF EXISTS "reinigung_daily_reports_insert" ON public.daily_reports;
DROP POLICY IF EXISTS "reinigung_daily_reports_update" ON public.daily_reports;
DROP POLICY IF EXISTS "reinigung_daily_reports_delete" ON public.daily_reports;

CREATE POLICY "reinigung_daily_reports_select" ON public.daily_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('admin', 'patron')
          OR (p.hotel_id IS NOT NULL AND p.hotel_id = daily_reports.hotel_id)
        )
    )
  );

CREATE POLICY "reinigung_daily_reports_insert" ON public.daily_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('admin', 'patron')
          OR (p.hotel_id IS NOT NULL AND p.hotel_id = daily_reports.hotel_id)
        )
    )
  );

CREATE POLICY "reinigung_daily_reports_update" ON public.daily_reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('admin', 'patron')
          OR (p.hotel_id IS NOT NULL AND p.hotel_id = daily_reports.hotel_id)
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
          OR (p.hotel_id IS NOT NULL AND p.hotel_id = daily_reports.hotel_id)
        )
    )
  );

-- Silme: ihtiyac yoksa kapali (admin paneli yoksa)
-- CREATE POLICY "reinigung_daily_reports_delete" ...

-- ---------------------------------------------------------------------------
-- 4) pms_forecasts: RLS (aynı hotel / admin mantigi)
-- ---------------------------------------------------------------------------
ALTER TABLE public.pms_forecasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reinigung_pms_forecasts_select" ON public.pms_forecasts;
DROP POLICY IF EXISTS "reinigung_pms_forecasts_insert" ON public.pms_forecasts;
DROP POLICY IF EXISTS "reinigung_pms_forecasts_update" ON public.pms_forecasts;

CREATE POLICY "reinigung_pms_forecasts_select" ON public.pms_forecasts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('admin', 'patron')
          OR (p.hotel_id IS NOT NULL AND p.hotel_id = pms_forecasts.hotel_id)
        )
    )
  );

CREATE POLICY "reinigung_pms_forecasts_insert" ON public.pms_forecasts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('admin', 'patron')
          OR (p.hotel_id IS NOT NULL AND p.hotel_id = pms_forecasts.hotel_id)
        )
    )
  );

CREATE POLICY "reinigung_pms_forecasts_update" ON public.pms_forecasts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('admin', 'patron')
          OR (p.hotel_id IS NOT NULL AND p.hotel_id = pms_forecasts.hotel_id)
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
          OR (p.hotel_id IS NOT NULL AND p.hotel_id = pms_forecasts.hotel_id)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 5) Storage: Zimmerlisten-Fotos (env: NEXT_PUBLIC_SUPABASE_REPORTS_BUCKET, default room-list)
--    getPublicUrl kullanildigi icin bucket public; okuma public olabilir
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'room-list',
  'room-list',
  true,
  52428800,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/heic']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "reinigung_room_list_select" ON storage.objects;
DROP POLICY IF EXISTS "reinigung_room_list_insert" ON storage.objects;
DROP POLICY IF EXISTS "reinigung_room_list_update" ON storage.objects;
DROP POLICY IF EXISTS "reinigung_room_list_delete" ON storage.objects;

-- Public read: public URL + img src
CREATE POLICY "reinigung_room_list_select" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'room-list');

CREATE POLICY "reinigung_room_list_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'room-list');

-- Ayni dosyayı tekrar yüklemek / metadata (isteğe bağlı; uygulama genelde sadece insert)
CREATE POLICY "reinigung_room_list_update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'room-list')
  WITH CHECK (bucket_id = 'room-list');

CREATE POLICY "reinigung_room_list_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'room-list');

-- ---------------------------------------------------------------------------
-- 6) Storage: Dienstplan bucket + policies
--    dienstplan-module.tsx public URL kullaniyor, bu nedenle SELECT public acik.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dienstplan',
  'dienstplan',
  true,
  52428800,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "reinigung_dienstplan_select_public" ON storage.objects;
DROP POLICY IF EXISTS "reinigung_dienstplan_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "reinigung_dienstplan_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "reinigung_dienstplan_delete_authenticated" ON storage.objects;

CREATE POLICY "reinigung_dienstplan_select_public" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'dienstplan');

CREATE POLICY "reinigung_dienstplan_insert_authenticated" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'dienstplan');

CREATE POLICY "reinigung_dienstplan_update_authenticated" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'dienstplan')
  WITH CHECK (bucket_id = 'dienstplan');

CREATE POLICY "reinigung_dienstplan_delete_authenticated" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'dienstplan');

-- Bitti. Dashboard > Storage: room-list + dienstplan bucket görünmeli; Forecast/Dienstplan 403/427 almamali.
