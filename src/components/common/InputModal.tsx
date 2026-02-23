import { ReactNode, useState, useEffect } from "react";
import { X } from "lucide-react";
import Button from "./Button";
import TextInput from "./TextInput";

interface InputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => Promise<void>;
  initialValue?: string;
  title: string;
  placeholder?: string;
  icon?: ReactNode;
  confirmText?: string;
  cancelText?: string;
}

export default function InputModal({
  isOpen,
  onClose,
  onConfirm,
  initialValue = "",
  title,
  placeholder = "입력하세요",
  icon,
  confirmText = "확인",
  cancelText = "취소",
}: InputModalProps) {
  const [value, setValue] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!value.trim() || value === initialValue) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(value);
      onClose();
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[520px] bg-[#1C1C1C] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            {icon && icon}
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <TextInput
            value={value}
            onChange={setValue}
            placeholder={placeholder}
            disabled={isSubmitting}
          />

          <div className="flex gap-4 mt-10 w-full">
            <div className="flex-1">
              <Button
                label={cancelText}
                onClick={onClose}
                disabled={isSubmitting}
                color="white"
                className="h-[60px] !aspect-auto"
              />
            </div>
            <div className="flex-1">
              <Button
                label={isSubmitting ? "처리 중..." : confirmText}
                onClick={handleSubmit}
                disabled={isSubmitting || !value.trim() || value === initialValue}
                color="red"
                className="h-[60px] !aspect-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
