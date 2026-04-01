export const PERMISSIONS = {
  FOLDER_WRITE: 'folder:write',
  UPLOAD_WRITE: 'upload:write',
  GENERATE_SRT_WRITE: 'generate_srt:write',
  MANAGE_USERS: 'manage:users',
  MANAGE_AI: 'manage:ai',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PROFILE_PERMISSIONS: Record<string, Permission[]> = {
  CLIENT: [
    PERMISSIONS.FOLDER_WRITE,
    PERMISSIONS.UPLOAD_WRITE,
    PERMISSIONS.GENERATE_SRT_WRITE,
  ],
  MANAGER: [
    PERMISSIONS.FOLDER_WRITE,
    PERMISSIONS.UPLOAD_WRITE,
    PERMISSIONS.GENERATE_SRT_WRITE,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_AI,
  ],
};
