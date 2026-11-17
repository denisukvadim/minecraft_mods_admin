/**
 * Wire types mirroring the backend DTOs in `minecraftmods_backend`.
 * Keep the names identical to the JSON payloads: no mapping layer.
 */

export interface ApiError {
  error: string;
  message: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_at: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface MeResponse {
  id: string;
  email: string;
  username: string;
  roles: string[];
  permissions: string[];
}

export interface PermissionDto {
  id: string;
  code: string;
  description: string | null;
  created_at: string;
}

export interface RoleSummary {
  id: string;
  name: string;
}

export interface RoleDto {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  permissions: PermissionDto[];
}

export interface UserSummary {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  created_at: string;
}

export interface UserDetail extends UserSummary {
  roles: RoleSummary[];
  direct_permissions: PermissionDto[];
  effective_permissions: string[];
}

export interface CreateUserRequest {
  email: string;
  username: string;
  password: string;
  roles?: string[];
  is_active?: boolean;
}

export interface UpdateUserRequest {
  email?: string;
  username?: string;
  password?: string;
  is_active?: boolean;
}

export interface AccessResponse {
  user_id: string;
  roles: RoleSummary[];
  direct_permissions: PermissionDto[];
  effective_permissions: string[];
}

export interface CreatePermissionRequest {
  code: string;
  description?: string | null;
}

export interface CreateRoleRequest {
  name: string;
  description?: string | null;
  permissions?: string[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string | null;
  permissions?: string[];
}

export interface ModFileDto {
  file_name: string;
  size_bytes: number;
  modified_at: string | null;
}

export type ModAction = 'upload' | 'download' | 'delete';

export interface ModFileActionDto {
  id: number;
  user_id: string | null;
  user_email: string | null;
  username: string | null;
  action: ModAction;
  file_name: string;
  created_at: string;
}

/** Mirrors `ServerStatusDto` from the backend's `/server/status`. */
export interface ServerStatusDto {
  container: string;
  image: string | null;
  state: string;
  running: boolean;
  started_at: string | null;
  finished_at: string | null;
  restart_count: number;
  health: string | null;
}

/** Mirrors `ServerLogsDto` from the backend's `/server/logs`. */
export interface ServerLogsDto {
  container: string;
  tail: number;
  timestamps: boolean;
  logs: string;
}

export interface PageRequest {
  limit: number;
  offset: number;
}
