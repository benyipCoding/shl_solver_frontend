import React from "react";
import { AlertCircle } from "lucide-react";
import { ValidatedInputProps } from "@/interfaces/auth";

interface ValidatedInputComponentProps extends ValidatedInputProps {
  value: string | undefined;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
}

const ValidatedInput: React.FC<ValidatedInputComponentProps> = ({
  type,
  name,
  value,
  onChange,
  error,
  placeholder,
  icon: Icon,
  required = false,
  maxLength,
}) => (
  <div className="space-y-1 relative">
    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-1">
      {name === "email" && "邮箱"}
      {name === "password" && "密码"}
      {name === "confirmPassword" && "确认密码"}
      {name === "username" && "用户名"}
      {name === "captcha" && "验证码"}
    </label>
    <div className="relative">
      {Icon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Icon className="h-5 w-5 text-slate-400" />
        </div>
      )}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className={`block w-full ${Icon ? "pl-10" : "px-3"} pr-3 py-2 md:py-2.5 bg-slate-50 border ${error ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"} rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm ${name === "captcha" ? "text-center tracking-widest uppercase" : ""}`}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
      />
      {error && (
        <div className="absolute -bottom-5 left-1 text-[10px] text-red-500 font-medium animate-fadeIn flex items-center bg-white/80 px-1 rounded z-10">
          <AlertCircle className="w-2.5 h-2.5 mr-1" /> {error}
        </div>
      )}
    </div>
  </div>
);

export default ValidatedInput;
