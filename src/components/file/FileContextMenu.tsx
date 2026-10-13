import { useEffect, useRef } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";

interface Position {
  x: number;
  y: number;
}

interface FileContextMenuProps {
  position: Position;
  onClose: () => void;
  onPreview: () => void;
  onRename: () => void;
  /** 없으면 삭제 메뉴를 숨긴다 (파일 지우기는 부장 이상) */
  onDelete?: () => void;
}

export default function FileContextMenu({
  position,
  onClose,
  onPreview,
  onRename,
  onDelete,
}: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${viewportWidth - rect.width - 10}px`;
      }
      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${viewportHeight - rect.height - 10}px`;
      }
    }
  }, [position]);

  return (
    <div
      ref={menuRef}
      data-tour="files.menu"
      className="fixed z-50 flex flex-col w-48 py-1.5 rounded-xl border border-white/10 bg-[#252525] shadow-2xl backdrop-blur-xl max-md:inset-x-4! max-md:top-auto! max-md:bottom-[calc(76px+env(safe-area-inset-bottom))] max-md:w-auto max-md:rounded-[20px] max-md:py-2"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <button
        data-tour="files.menu.preview"
        onClick={() => {
          onPreview();
          onClose();
        }}
        className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/90 max-md:min-h-12 max-md:text-[15px] hover:bg-white/10 hover:text-white transition-colors w-full text-left"
      >
        <Eye size={16} className="text-white/50" />
        미리보기
      </button>

      <button
        data-tour="files.menu.rename"
        onClick={() => {
          onRename();
          onClose();
        }}
        className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/90 max-md:min-h-12 max-md:text-[15px] hover:bg-white/10 hover:text-white transition-colors w-full text-left"
      >
        <Pencil size={16} className="text-white/50" />
        이름 수정
      </button>

      {onDelete && (
        <>
      <div className="h-px bg-white/10 my-1 w-full" />

      <button
        data-tour="files.menu.delete"
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-500/90 max-md:min-h-12 max-md:text-[15px] hover:bg-red-500/10 hover:text-red-500 transition-colors w-full text-left"
      >
        <Trash2 size={16} className="text-red-500/50" />
        삭제
      </button>
        </>
      )}
    </div>
  );
}
