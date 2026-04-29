-- Fix for: cannot update table "pms_forecasts" because it does not have a replica identity (55000)
-- Run this in Supabase SQL Editor.

ALTER TABLE public.pms_forecasts REPLICA IDENTITY FULL;

-- Optional stronger setup:
-- If (hotel_id, forecast_date) is unique, you can switch to index-based replica identity:
-- CREATE UNIQUE INDEX IF NOT EXISTS pms_forecasts_hotel_id_forecast_date_key
--   ON public.pms_forecasts (hotel_id, forecast_date);
-- ALTER TABLE public.pms_forecasts
--   REPLICA IDENTITY USING INDEX pms_forecasts_hotel_id_forecast_date_key;
