export type Role = 'ADMIN' | 'MANAGER' | 'CONSULTANT';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface HealthResponse {
  status: string;
  database: string;
  timestamp: string;
}
