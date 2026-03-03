"use client";

import BookList from "@/components/book/BookList";
import BookEditor from "@/components/book/BookEditor";
import { useBook } from "@/hooks/useBook";
import SectionHeader from "@/components/common/SectionHeader";

export default function BookPage() {
  const { books, activeBook, isCreating, isLoading, selectBook, saveBook, deleteBook, createNew } = useBook();

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
        <SectionHeader>예약 세팅</SectionHeader>
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center text-white/50 font-pretendard">데이터를 불러오는 중...</div>
        ) : (activeBook || isCreating) ? (
          <BookEditor
            book={activeBook}
            onSave={saveBook}
            onDelete={activeBook ? () => deleteBook(activeBook.id) : undefined}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center border border-white/5 bg-[#0a0a0a] rounded-3xl gap-4">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="text-white/30 text-lg font-pretendard">수정할 예약을 선택하거나 새 예약을 추가해 주세요</p>
          </div>
        )}
      </div>
    </div>
  );
}
