-- Los QR impresos de 2021 contienen 16 caracteres hexadecimales en mayúsculas.
-- El código interno de 32 caracteres sigue siendo el identificador del punto.
alter table public.qr_codes
  add column legacy_code text unique,
  add constraint qr_codes_legacy_code_format
    check (legacy_code is null or legacy_code ~ '^[0-9A-F]{16}$');
