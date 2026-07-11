import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

export type CommunityBrandAssetKind = "icon" | "banner";
export type CommunityBrandUpload = Readonly<{ url: string; storagePath?: string }>;
type Result<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; message: string }>;

const allowedTypes = new Map([["image/png", "png"], ["image/jpeg", "jpg"], ["image/webp", "webp"]]);
const maxBytes: Record<CommunityBrandAssetKind, number> = { icon: 2 * 1024 * 1024, banner: 6 * 1024 * 1024 };

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Invalid image result"));
    reader.onerror = () => reject(new Error("Image preview could not be read"));
    reader.readAsDataURL(file);
  });
}

export const communityBrandingService = {
  validate(file: File, kind: CommunityBrandAssetKind): Result<true> {
    if (!allowedTypes.has(file.type)) return { ok: false, message: "Choose a PNG, JPG, or WEBP image." };
    if (file.size <= 0 || file.size > maxBytes[kind]) return { ok: false, message: `${kind === "icon" ? "Icons" : "Banners"} must be ${maxBytes[kind] / 1024 / 1024} MB or smaller.` };
    return { ok: true, data: true };
  },

  async upload(communityId: string, kind: CommunityBrandAssetKind, file: File): Promise<Result<CommunityBrandUpload>> {
    const validation = this.validate(file, kind);
    if (!validation.ok) return validation;
    if (dataSourceService.getStatus().isMock) {
      try { return { ok: true, data: { url: await readDataUrl(file) } }; }
      catch { return { ok: false, message: "Picom could not prepare the branding preview." }; }
    }
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Community branding storage is unavailable." };
    const extension = allowedTypes.get(file.type);
    const storagePath = `${communityId}/${kind}/${crypto.randomUUID()}.${extension}`;
    const upload = await client.storage.from("community-branding").upload(storagePath, file, { cacheControl: "3600", contentType: file.type, upsert: false });
    if (upload.error) return { ok: false, message: `Picom could not upload the community ${kind}.` };
    const publicUrl = client.storage.from("community-branding").getPublicUrl(storagePath).data.publicUrl;
    if (!publicUrl) {
      await client.storage.from("community-branding").remove([storagePath]);
      return { ok: false, message: "Picom could not resolve the uploaded branding asset." };
    }
    return { ok: true, data: { url: publicUrl, storagePath } };
  },

  async remove(storagePath: string): Promise<void> {
    if (dataSourceService.getStatus().isMock) return;
    const client = getSupabaseClient();
    if (client) await client.storage.from("community-branding").remove([storagePath]);
  },
};
