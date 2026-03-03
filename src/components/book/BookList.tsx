import BookCard from "./BookCard";
import { Book } from "@/types/book";
import Button from "@/components/common/Button";
import SectionHeader from "@/components/common/SectionHeader";

interface BookListProps {
  books: Book[];
  activeBookId: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
}

export default function BookList({ books, activeBookId, onSelect, onCreateNew }: BookListProps) {
  return (
    <div className="flex h-full w-[360px] flex-col gap-[20px] pb-4">
      <SectionHeader>방송예약</SectionHeader>
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mt-4">
        {books.map(book => (
          <BookCard
            key={book.id}
            book={book}
            isSelected={book.id === activeBookId}
            onClick={() => onSelect(book.id)}
          />
        ))}
      </div>
      <div className="mt-auto px-2">
        <Button
          label="방송 예약하기"
          onClick={onCreateNew}
          color="#38E2C7"
          glowSize="12px"
          className="h-[64px]"
        />
      </div>
    </div>
  );
}
