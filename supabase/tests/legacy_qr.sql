-- Código ficticio local para probar el formato del PDF sin publicar sus valores.
do $$
begin
  update public.qr_codes set legacy_code = 'ABCDEF0123456789'
  where public_code = '11111111111111111111111111111111';
  if not found then raise exception 'Falta QR de prueba'; end if;
  if not exists (
    select 1 from public.qr_codes
    where legacy_code = 'ABCDEF0123456789' and revoked_at is null
  ) then raise exception 'Falta asociación de QR heredado'; end if;
end $$;
