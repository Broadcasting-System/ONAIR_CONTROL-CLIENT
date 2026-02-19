import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export default function SectionHeader({ children, className }: SectionHeaderProps) {
  return (
    <h2 className={cn("mb-3 text-3xl font-mbc text-white", className)}>
      {children}
    </h2>
  );
}
