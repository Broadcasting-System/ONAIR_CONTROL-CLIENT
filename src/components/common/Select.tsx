"use client";

import { useMemo, type ReactNode } from "react";
import { Select as S } from "radix-ui";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ONAIR 드롭다운 — 기본 <select> 대신 쓰는 앱 모양 고르기 칸.
 *
 * - 값은 문자열·숫자 그대로 주고받는다 (숫자 옵션이면 onChange 도 숫자).
 * - 빈 문자열("")도 보통 옵션 값으로 쓸 수 있다.
 * - value 와 맞는 옵션이 없으면 placeholder 를 보여 준다.
 * - 목록은 포털로 띄워서 모달·CUE 패널 안에서도 위에 뜨고, 아래 자리가 없으면 위로 뒤집힌다.
 * - 키보드(↑↓·Home·End·Enter·Space·Esc·글자 찾기)·바깥 누르면 닫기는 Radix Select 가 맡는다.
 */

export type SelectValue = string | number;

export type SelectOption<T extends SelectValue> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  /** label 이 글자가 아닐 때 글자 찾기에 쓸 글 */
  textValue?: string;
};

export type SelectGroup<T extends SelectValue> = {
  label: string;
  options: SelectOption<T>[];
};

type Item<T extends SelectValue> = SelectOption<T> | SelectGroup<T>;

const isGroup = <T extends SelectValue>(o: Item<T>): o is SelectGroup<T> => "options" in o;

/** 다른 입력 칸과 같은 기본 모양 — className 으로 덮어쓴다 */
const triggerBase =
  "inline-flex h-10 min-w-0 items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#141414] px-3 text-left font-pretendard text-sm text-white outline-none transition-colors focus:border-white/30 focus-visible:border-white/30 data-[state=open]:border-white/30 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer";

export default function Select<T extends SelectValue>({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  contentClassName,
  id,
  name,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  tour,
}: {
  value: T | null | undefined;
  onChange: (value: T) => void;
  options: Item<T>[];
  placeholder?: ReactNode;
  disabled?: boolean;
  /** 고르기 버튼(트리거) 모양 */
  className?: string;
  /** 펼친 목록 모양 */
  contentClassName?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  /** CUE 튜토리얼이 가리킬 이름표 (data-tour) */
  tour?: string;
}) {
  // Radix 는 값이 문자열이고 ""를 못 쓰므로, 옵션 순번을 값으로 쓴다
  const flat = useMemo(() => options.flatMap((o) => (isGroup(o) ? o.options : [o])), [options]);
  const index = flat.findIndex((o) => o.value === value);
  let n = 0;

  const renderOption = (o: SelectOption<T>) => {
    const key = String(n++);
    return (
      <S.Item
        key={key}
        value={key}
        disabled={o.disabled}
        textValue={o.textValue ?? (typeof o.label === "string" || typeof o.label === "number" ? String(o.label) : undefined)}
        className={cn(
          "relative flex min-h-9 cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-9 font-pretendard text-sm leading-snug text-white/75 outline-none",
          "data-[highlighted]:bg-white/[0.08] data-[highlighted]:text-white data-[state=checked]:text-white",
          "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-35",
        )}
      >
        <S.ItemText>{o.label}</S.ItemText>
        <S.ItemIndicator className="absolute right-3 inline-flex items-center text-white">
          <Check size={15} strokeWidth={2.5} />
        </S.ItemIndicator>
      </S.Item>
    );
  };

  return (
    <S.Root
      value={index >= 0 ? String(index) : ""}
      onValueChange={(v) => {
        const picked = flat[Number(v)];
        if (picked && picked.value !== value) onChange(picked.value);
      }}
      disabled={disabled}
      name={name}
    >
      <S.Trigger data-tour={tour} id={id} aria-label={ariaLabel} aria-invalid={ariaInvalid} className={cn(triggerBase, className)}>
        {/* 기본 <select> 처럼 가장 긴 옵션 너비에 맞춘다 — 숨은 글자들을 같은 칸에 겹쳐 둔다 */}
        <span className="grid min-w-0 flex-1">
          <span className={cn("col-start-1 row-start-1 truncate", index < 0 && "text-white/40")}>
            <S.Value placeholder={placeholder ?? "고르기"} />
          </span>
          {[placeholder ?? "고르기", ...flat.map((o) => o.label)].map((label, i) => (
            <span key={i} aria-hidden className="invisible col-start-1 row-start-1 h-0 overflow-hidden whitespace-nowrap">
              {label}
            </span>
          ))}
        </span>
        <S.Icon className="shrink-0 text-white/40">
          <ChevronDown size={15} />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            "relative z-[900] flex max-h-[min(340px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] max-w-[min(520px,calc(100vw-24px))] flex-col overflow-hidden",
            "rounded-xl border border-white/10 bg-[#161618] text-white shadow-[0_18px_40px_-10px_rgba(0,0,0,0.85)]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]",
            contentClassName,
          )}
        >
          <S.ScrollUpButton className="flex h-6 shrink-0 cursor-default items-center justify-center text-white/45">
            <ChevronUp size={14} />
          </S.ScrollUpButton>
          <S.Viewport className="p-1">
            {options.map((o, gi) =>
              isGroup(o) ? (
                <S.Group key={`g${gi}`} className="[&+&]:mt-1 [&+&]:border-t [&+&]:border-white/[0.06] [&+&]:pt-1">
                  <S.Label className="px-3 pb-1 pt-2 font-pretendard text-[12px] font-semibold text-white/40">
                    {o.label}
                  </S.Label>
                  {o.options.map(renderOption)}
                </S.Group>
              ) : (
                renderOption(o)
              ),
            )}
          </S.Viewport>
          <S.ScrollDownButton className="flex h-6 shrink-0 cursor-default items-center justify-center text-white/45">
            <ChevronDown size={14} />
          </S.ScrollDownButton>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
