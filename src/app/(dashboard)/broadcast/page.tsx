"use client";

import BookList from "@/components/book/BookList";
import BookEditor from "@/components/book/BookEditor";
import { useBook } from "@/hooks/useBook";
import SectionHeader from "@/components/common/SectionHeader";

export default function BookPage() {
  const { books, activeBook, selectBook, saveBook, deleteBook, createNew } = useBook();

  return (
    <div className="flex h-full w-full gap-[40px] px-[20px]">
      <BookList
        books={books}
        activeBookId={activeBook?.id || null}
        onSelect={selectBook}
        onCreateNew={createNew}
      />
      <div className="h-full w-[1px] bg-white/10" />
      <div className="flex flex-1 flex-col gap-6 w-full max-w-[800px]">
        <SectionHeader>방송 모니터링 1</SectionHeader>
        <BookEditor
          book={activeBook}
          onSave={saveBook}
          onDelete={activeBook ? () => deleteBook(activeBook.id) : undefined}
        />
      </div>
    </div>
  );
}
