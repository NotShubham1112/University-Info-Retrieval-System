import { createServiceClient } from "@/lib/supabase/service";

export const BUCKET = "student-documents";

export function storageKey(studentId: number, type: string, fileName: string): string {
  return `students/${studentId}/${type}/${fileName}`;
}

export async function ensureBucket() {
  const svc = createServiceClient();
  const { data, error } = await svc.storage.getBucket(BUCKET);
  if (error?.message?.includes("not found")) {
    await svc.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 20 * 1024 * 1024,
    });
    return;
  }
  if (error) throw error;
  return data;
}

export async function createSignedUrl(path: string, expiresIn = 600) {
  const svc = createServiceClient();
  const { data, error } = await svc.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
