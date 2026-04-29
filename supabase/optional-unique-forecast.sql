-- pms_forecasts: (hotel_id, forecast_date) cifti tekil olsun (upsert ve liste mantigi)
-- HATA: "could not create unique index ..." => once yinelenen satirlari manuel silin/ birlestirin.
-- Sonra asagidaki satirlari tekrar calistirin.

CREATE UNIQUE INDEX IF NOT EXISTS pms_forecasts_hotel_id_forecast_date_key
  ON public.pms_forecasts (hotel_id, forecast_date);

-- Realtime publish UPDATE hatasini (code 55000) kalici kapatmak icin:
-- UNIQUE index olustuktan sonra replica identity'i bu index ile kullanin.
ALTER TABLE public.pms_forecasts
  REPLICA IDENTITY USING INDEX pms_forecasts_hotel_id_forecast_date_key;
