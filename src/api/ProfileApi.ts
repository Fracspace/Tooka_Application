import authAxiosClient from './authAxiosClient';
import type {
  AvatarUploadResponse,
  DeleteAccountResponse,
  ProfileApiResponse,
  UpdateProfilePayload,
  UserProfile,
} from '../types/profile';
import { normalizeProfileResponse } from '../utils/profileMappers';

const ProfileApi = {
  getProfile: async (signal?: AbortSignal): Promise<UserProfile> => {
    const response = await authAxiosClient.get<ProfileApiResponse>('/users/profile', { signal });
    return normalizeProfileResponse(response.data);
  },

  uploadAvatar: async (
    asset: { uri: string; type?: string; fileName?: string },
    signal?: AbortSignal,
  ): Promise<AvatarUploadResponse> => {
    const formData = new FormData();
    formData.append('avatar', {
      uri: asset.uri,
      type: asset.type || 'image/jpeg',
      name: asset.fileName || 'upload.jpg',
    } as any);

    const response = await authAxiosClient.put<AvatarUploadResponse>('/users/profile/avatar', formData, {
      signal,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  updateProfile: async (
    payload: UpdateProfilePayload,
    signal?: AbortSignal,
  ): Promise<UserProfile | null> => {
    console.log("UPdate peofile payload: ", payload);
    const response = await authAxiosClient.put<ProfileApiResponse>(
      '/users/profile',
      payload,
      { signal },
    );
    console.log("Response:", response.data);

    const raw =
      response.data?.data ??
      response.data?.profile ??
      response.data?.user ??
      null;

    return raw ? normalizeProfileResponse(response.data) : null;
  },

  deleteAccount: async (signal?: AbortSignal): Promise<DeleteAccountResponse> => {
    const response = await authAxiosClient.delete<DeleteAccountResponse>('/users/me', { signal });
    return response.data;
  },
};

export default ProfileApi;
