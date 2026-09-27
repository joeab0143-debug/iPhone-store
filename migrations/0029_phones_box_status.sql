-- Whether a purchased phone's original box was kept -- set from a "With
-- Box" / "Without Box" checkbox pair on the Buy sheet (and editable later
-- from Stock's Edit sheet), printed on the sticker label (see
-- PrintLabelCell.tsx). NULL for phones bought before this field existed.
ALTER TABLE phones ADD COLUMN box_status TEXT;
