-- Your brand (SPEC M2.6): the logo's shape on recaps, share images and link
-- previews. Circle by default; square is a rounded square. Covered by the
-- table grants and the owner's update policy on businesses.
alter table businesses
  add column logo_shape text not null default 'circle'
  check (logo_shape in ('circle', 'square'));
