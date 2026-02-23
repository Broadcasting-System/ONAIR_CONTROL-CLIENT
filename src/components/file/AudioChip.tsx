

interface AudioChipProps {
  fileName: string;
  fileUrl: string;
  onSelect?: (e: React.MouseEvent) => void;
}

export default function AudioChip({
  fileName,
  onSelect,
}: AudioChipProps) {
  return (
    <div
      className="group relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-white/10 bg-[#2C2C2C] hover:bg-[#3C3C3C] hover:border-white/30 transition-all cursor-context-menu shadow-lg"
      onContextMenu={(e) => {
        e.preventDefault();
        onSelect?.(e);
      }}
      onClick={(e) => onSelect?.(e)}
    >
      <span className="text-sm font-medium text-white truncate max-w-[120px]" title={fileName}>
        {fileName}
      </span>
    </div>
  );
}
