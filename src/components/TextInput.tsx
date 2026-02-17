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
        "h-[50px] rounded-md border border-white/10 bg-[#1A1A1A] px-4 text-base text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      )}
    />
  );
}
