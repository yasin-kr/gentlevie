"use server";

import { redirect } from "next/navigation";
import { confirmNewsletter, unsubscribeNewsletter } from "@/lib/newsletter";

export async function confirmSubscription(form: FormData) {
  const token = form.get("token");
  let status = "gecersiz";
  try {
    if (typeof token === "string" && await confirmNewsletter(token)) status = "onaylandi";
  } catch { status = "hata"; }
  redirect(`/bulten/sonuc?durum=${status}`);
}

export async function cancelSubscription(form: FormData) {
  const token = form.get("token");
  let status = "gecersiz";
  try {
    if (typeof token === "string" && await unsubscribeNewsletter(token)) status = "ayrildin";
  } catch { status = "hata"; }
  redirect(`/bulten/sonuc?durum=${status}`);
}
