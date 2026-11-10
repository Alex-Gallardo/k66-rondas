export function supabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
  return value;
}

export function publishableKey() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!value) throw new Error("Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return value;
}

export function secretKey() {
  const value = process.env.SUPABASE_SECRET_KEY;
  if (!value) throw new Error("Falta SUPABASE_SECRET_KEY");
  return value;
}
