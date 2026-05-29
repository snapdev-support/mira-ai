import { api } from './api';
import type { UserPublic } from "@/types/backend";

export async function getMe(): Promise<UserPublic> {
  const response = await api.get<UserPublic>("/profile/me");
  return response.data;
}

export async function uploadProfilePicture(file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  await api.post("/profile/picture", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
}