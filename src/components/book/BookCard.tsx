import { memo } from "react";
import { Book } from "@/types/book";
import { cn } from "@/lib/utils";

interface BookCardProps {
  book: Book;
  isSelected: boolean;
  onClick: () => void;
}

const formatDays = (days: string[]) => {
  if (days.includes("P")) return "P (특수일)";
  const koMap: Record<string, string> = { M: "월", T: "화", W: "수", TH: "목", F: "금" };
  return days.map(d => koMap[d] || d).join(", ");
};

const BookCard = memo(({ book, isSelected, onClick }: BookCardProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full h-[60px] rounded-[8px] flex items-center justify-between px-[20px] transition-all relative overflow-hidden text-left mb-2",
        isSelected
          ? "bg-[rgba(213,185,185,0.2)] shadow-[0_0_20px_-5px_#c69efa,inset_0_0_10px_-2px_#c69efa] border border-white/20"
          : "bg-transparent border border-[rgba(255,255,255,0.05)] hover:bg-white/5"
      )}
    >
      <span className="font-semibold text-[16px] text-white truncate max-w-[200px]">
        {book.name}
      </span>
      <div className="flex flex-col items-end gap-[4px] text-[14px]">
        {book.date && <span className="font-medium text-[#d1d1d1] leading-none">{book.date}</span>}
        <span className="font-medium text-[#d1d1d1] leading-none truncate max-w-[100px]">
          {formatDays(book.days)} {book.time}
        </span>
      </div>
    </button>
  );
});

BookCard.displayName = "BookCard";
export default BookCard;
