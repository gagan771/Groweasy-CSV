import type { ImportResponse } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function uploadCsv(file: File): Promise<ImportResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/imports`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Server error (${res.status})`);
  }

  return res.json();
}
