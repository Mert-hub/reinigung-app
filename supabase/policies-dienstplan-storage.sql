-- Dienstplan: Storage yuklemesi "new row violates row-level security" duzeltmesi
-- Supabase SQL Editor'da (veya migration olarak) calistirin.
-- Bucket: dienstplan (olusturulmus olmali, public read istege bagli)

-- Mevcut politikalari kontrol edin: Storage > dienstplan > Policies

-- Oneri A (gelistirme): tum authenticated yukleme
CREATE POLICY "dienstplan_insert_authenticated"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'dienstplan');

CREATE POLICY "dienstplan_select_authenticated"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'dienstplan');

-- Istege bagli: public read (sadece public URL ihtiyaci varsa)
-- CREATE POLICY "dienstplan_select_public" ON storage.objects
--   FOR SELECT TO public USING (bucket_id = 'dienstplan');

-- Ayni isimde policy varsa once DROP edin veya isim degistirin.
