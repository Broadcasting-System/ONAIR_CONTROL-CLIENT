import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Book, BookDayType } from "@/types/book";
import { getApiBase } from "@/lib/apiBase";

const DAY_MAP_TO_KO: Record<string, string> = {
  M: "월",
  T: "화",
  W: "수",
  TH: "목",
  F: "금",
  S: "토",
  SU: "일",
};

const DAY_MAP_TO_EN: Record<string, string> = {
  "월": "M",
  "화": "T",
  "수": "W",
  "목": "TH",
  "금": "F",
  "토": "S",
  "일": "SU",
};

export type MediaType = "audio" | "image" | "video" | "presentation" | "tts";

interface BackendSchedule {
  id: string;
  name: string;
  type: string;
  content: string;
  schedule: {
    days?: string[];
    date?: string;
    time: string;
  };
}

export function useBook() {
  const queryClient = useQueryClient();
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: rawSchedules, isLoading } = useQuery<BackendSchedule[]>({
    queryKey: ["bookSchedules"],
    queryFn: async () => {
      const BASE = getApiBase();
      const res = await fetch(`${BASE}/broadcast/schedules`);
      if (!res.ok) throw new Error("예약 목록 로드 실패");
      const json = await res.json();
      return json.schedules;
    },
  });

  const books = useMemo<Book[]>(() => {
    if (!rawSchedules) return [];
    return rawSchedules.map((s) => ({
      id: s.id,
      name: s.name || s.content.split("/").pop() || "이름 없음",
      time: s.schedule.time,
      date: s.schedule.date?.replace(/-/g, "."),
      days: s.schedule.days ? (s.schedule.days.map((d) => DAY_MAP_TO_EN[d]) as BookDayType[]) : ["P"],
      mediaUrl: s.content,
      mediaType: s.type as MediaType,
    }));
  }, [rawSchedules]);

  const saveMutation = useMutation({
    mutationFn: async (book: Book) => {
      const BASE = getApiBase();
      const payload: BackendSchedule = {
        id: book.id,
        name: book.name,
        type: book.mediaType || "image",
        content: book.mediaUrl || "",
        schedule: {
          time: book.time,
          // P(특수일)는 날짜 기반, 그 외는 요일 기반. P일 때 days로 새지 않게 분리.
          ...(book.days.includes("P")
            ? { date: (book.date ?? "").replace(/\./g, "-") }
            : { days: book.days.map((d) => DAY_MAP_TO_KO[d]) }),
        },
      };

      const res = await fetch(`${BASE}/broadcast/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("저장 실패");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookSchedules"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const BASE = getApiBase();
      const res = await fetch(`${BASE}/broadcast/schedule/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("삭제 실패");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookSchedules"] });
    },
  });

  const activeBook = useMemo(() => books.find((b) => b.id === activeBookId) || null, [books, activeBookId]);

  const selectBook = useCallback((id: string) => {
    setActiveBookId(id);
    setIsCreating(false);
  }, []);

  const saveBook = useCallback((book: Book) => {
    saveMutation.mutate(book);
    setActiveBookId(book.id);
  }, [saveMutation]);

  const deleteBook = useCallback((id: string) => {
    deleteMutation.mutate(id);
    if (activeBookId === id) setActiveBookId(null);
  }, [activeBookId, deleteMutation]);

  const createNew = useCallback(() => {
    setActiveBookId(null);
    setIsCreating(true);
  }, []);

  return {
    books,
    activeBook,
    isCreating,
    isLoading,
    selectBook,
    saveBook,
    deleteBook,
    createNew,
  };
}
