-- Buy flow now distinguishes a supplier purchase from buying a phone
-- straight off an individual. For an individual seller we also keep two
-- NID card photos and one photo of the person for accountability. All
-- three are compressed client-side to small JPEG data URLs before they
-- ever reach here, so this stays cheap to store in D1.
ALTER TABLE phones ADD COLUMN seller_type TEXT NOT NULL DEFAULT 'supplier';
ALTER TABLE phones ADD COLUMN nid_front_photo TEXT;
ALTER TABLE phones ADD COLUMN nid_back_photo TEXT;
ALTER TABLE phones ADD COLUMN person_photo TEXT;
