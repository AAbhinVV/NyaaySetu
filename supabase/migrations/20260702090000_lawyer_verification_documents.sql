alter table lawyers
  add column if not exists state_bar_council text,
  add column if not exists enrollment_year integer,
  add column if not exists verification_document_url text;
