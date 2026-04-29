-- =============================================================================
-- Inventory tracking schema + RLS
-- Run in Supabase SQL Editor.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id text NOT NULL,
  item_name text NOT NULL,
  normalized_name text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'adet',
  location text NOT NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_items_unique_key UNIQUE (hotel_id, normalized_name, unit, location)
);

CREATE INDEX IF NOT EXISTS inventory_items_hotel_idx
  ON public.inventory_items (hotel_id, item_name);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reinigung_inventory_items_select" ON public.inventory_items;
DROP POLICY IF EXISTS "reinigung_inventory_items_insert" ON public.inventory_items;
DROP POLICY IF EXISTS "reinigung_inventory_items_update" ON public.inventory_items;
DROP POLICY IF EXISTS "reinigung_inventory_items_delete" ON public.inventory_items;

CREATE POLICY "reinigung_inventory_items_select" ON public.inventory_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('admin', 'patron')
          OR (p.hotel_id IS NOT NULL AND p.hotel_id = inventory_items.hotel_id)
        )
    )
  );

CREATE POLICY "reinigung_inventory_items_insert" ON public.inventory_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('admin', 'patron')
          OR (p.hotel_id IS NOT NULL AND p.hotel_id = inventory_items.hotel_id)
        )
    )
  );

CREATE POLICY "reinigung_inventory_items_update" ON public.inventory_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('admin', 'patron')
          OR (p.hotel_id IS NOT NULL AND p.hotel_id = inventory_items.hotel_id)
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
          OR (p.hotel_id IS NOT NULL AND p.hotel_id = inventory_items.hotel_id)
        )
    )
  );

CREATE POLICY "reinigung_inventory_items_delete" ON public.inventory_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('admin', 'patron')
          OR (p.hotel_id IS NOT NULL AND p.hotel_id = inventory_items.hotel_id)
        )
    )
  );
