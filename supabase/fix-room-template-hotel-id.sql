-- Fix mismatch between seeded room template hotel_id and app hotel_id.
-- App catalog id for Das Dreiburgenseehotel is: DBS

UPDATE public.hotel_room_templates
SET hotel_id = 'DBS'
WHERE hotel_id IN ('dreiburgensee', 'Das Dreiburgenseehotel', 'das dreiburgenseehotel');

-- Optional check:
-- SELECT hotel_id, count(*) FROM public.hotel_room_templates GROUP BY hotel_id ORDER BY hotel_id;
