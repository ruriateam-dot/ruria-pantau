"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  if (!email || !password) return "Isi email dan password.";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return "Email atau password salah. Coba lagi, atau minta admin mengatur ulang password.";
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
