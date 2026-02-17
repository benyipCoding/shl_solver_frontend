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

export interface ValidatedInputProps {
  type: string;
  name: string;
  placeholder: string;
  icon?: React.ElementType;
  required?: boolean;
  maxLength?: number;
}

export interface LocalAuthPayload {
  email: string;
  password: string;
}
