-- Guncel tam kurulum: `supabase/setup-production.sql`
-- (pms_forecasts total_occupancy + user_id, RLS, room-list storage)
--
-- Asagidaki otomatik politika tekrarlarini onlemek icin artik setup-production.sql kullanin.
-- Eski minimum ornek (gelistirme), yedek referans:

-- ALTER TABLE pms_forecasts ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "pms_forecast_select" ON pms_forecasts FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "pms_forecast_insert" ON pms_forecasts FOR INSERT TO authenticated WITH CHECK (true);
-- CREATE POLICY "pms_forecast_update" ON pms_forecasts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
