import Button from "@/components/common/Button";

interface GroupActionsProps {
  onCopy: () => void;
  onPaste: () => void;
  onReset: () => void;
  hasCopiedData: boolean;
}

export default function GroupActions({
  onCopy,
  onPaste,
  onReset,
  hasCopiedData,
}: GroupActionsProps) {
  return (
    <div className="flex w-full flex-col gap-3 md:w-[340px] md:gap-[16px]">
      <Button
        tour="time.copy"
        label="요일 시보 복사"
        onClick={onCopy}
        color="white"
        className="h-[56px] md:h-[64px]"
      />
      <Button
        tour="time.paste"
        label="요일 시보 붙여넣기"
        onClick={onPaste}
        disabled={!hasCopiedData}
        color="white"
        className="h-[56px] md:h-[64px]"
      />
      <Button
        tour="time.reset"
        label="초기화"
        onClick={onReset}
        color="red"
        className="h-[56px] md:h-[64px]"
      />
    </div>
  );
}
