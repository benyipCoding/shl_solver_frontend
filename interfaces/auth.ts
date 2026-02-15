export interface FormData {
  email?: string;
  password?: string;
  captcha?: string;
  username?: string;
  confirmPassword?: string;
  [key: string]: string | undefined;
}

export interface ValidationErrors {
  [key: string]: string;
}
