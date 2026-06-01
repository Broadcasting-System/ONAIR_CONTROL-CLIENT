"use client";

import { cn } from "@/lib/utils";

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  width?: string | number;
  disabled?: boolean;
}

export default function TextInput({
  value,
  onChange,
  placeholder,
  width = "100%",
  disabled = false,
}: TextInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{ width }}
      className={cn(
        "h-[64px] rounded-xl border border-white/5 bg-[#1C1C1C] px-6 text-lg font-pretendard text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all",
      )}
    />
  );
}
