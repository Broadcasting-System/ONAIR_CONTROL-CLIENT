import { useState, useCallback } from "react";
import { Book } from "@/types/book";

const INITIAL_BOOKS: Book[] = [
  { id: "1", name: "영어 듣기 평가", time: "08:30", days: ["W", "TH", "F"] },
  { id: "2", name: "학교폭력예방 교육 영상", time: "09:00", days: ["W", "F"] },
  { id: "3", name: "회의실", time: "10:00", days: ["F"] },
];

export function useBook() {
  const [books, setBooks] = useState<Book[]>(INITIAL_BOOKS);
  const [activeBookId, setActiveBookId] = useState<string | null>(INITIAL_BOOKS[0]?.id || null);

  const activeBook = books.find(b => b.id === activeBookId) || null;

  const selectBook = useCallback((id: string) => setActiveBookId(id), []);

  const saveBook = useCallback((book: Book) => {
    setBooks(prev => {
      const exists = prev.some(b => b.id === book.id);
      if (exists) {
        return prev.map(b => b.id === book.id ? book : b);
      }
      return [...prev, book];
    });
    setActiveBookId(book.id);
  }, []);

  const deleteBook = useCallback((id: string) => {
    setBooks(prev => prev.filter(b => b.id !== id));
    if (activeBookId === id) setActiveBookId(null);
  }, [activeBookId]);

  const createNew = useCallback(() => {
    setActiveBookId(null);
  }, []);

  return {
    books,
    activeBook,
    selectBook,
    saveBook,
    deleteBook,
    createNew
  };
}
