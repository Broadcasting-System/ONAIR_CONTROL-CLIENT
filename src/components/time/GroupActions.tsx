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
    <div className="flex flex-col gap-4 w-full max-w-[400px]">
      <Button
        label="요일 시보 복사"
        onClick={onCopy}
        color="white"
        className="h-[48px]"
      />
      <Button
        label="요일 시보 붙여넣기"
        onClick={onPaste}
        disabled={!hasCopiedData}
        color="white"
        className="h-[48px]"
      />
      <Button
        label="초기화"
        onClick={onReset}
        color="red"
        className="h-[48px]"
      />
    </div>
  );
}
