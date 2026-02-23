import { X, AlertTriangle } from "lucide-react";
import Button from "./Button";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "확인",
  cancelText = "취소",
  isDestructive = true,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[520px] bg-[#1C1C1C] border border-white/10 rounded-2xl shadow-2xl overflow-hidden translate-y-0 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            {isDestructive && <AlertTriangle size={18} className="text-red-500" />}
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
          <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
            {message}
          </p>

          <div className="flex gap-4 mt-10 w-full">
            <div className="flex-1">
              <Button label={cancelText} onClick={onClose} color="white" className="h-[60px] !aspect-auto" />
            </div>
            <div className="flex-1">
              <Button
                label={confirmText}
                onClick={handleConfirm}
                color={isDestructive ? "red" : "blue"}
                className="h-[60px] !aspect-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
