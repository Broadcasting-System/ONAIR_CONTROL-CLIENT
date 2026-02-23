

interface FileCardProps {
  fileUrl: string;
  thumbnailUrl: string;
  fileName: string;
  onSelect?: (e: React.MouseEvent) => void;
}

export default function FileCard({
  thumbnailUrl,
  fileName,
  onSelect,
}: FileCardProps) {
  return (
    <div
      className="group relative flex flex-col gap-2 rounded-xl border border-white/10 bg-[#1C1C1C] overflow-hidden hover:border-white/30 transition-colors cursor-context-menu aspect-video"
      onContextMenu={(e) => {
        e.preventDefault();
        onSelect?.(e);
      }}
      onClick={(e) => onSelect?.(e)}
    >
      {/* Thumbnail Area */}
      <div className="flex-1 w-full bg-black relative overflow-hidden flex items-center justify-center">
        {thumbnailUrl ? (
          fileName.match(/\.(mp4|webm)$/i) ? (
            <video src={thumbnailUrl} className="w-full h-full object-cover" muted playsInline />
          ) : (
            <img src={thumbnailUrl} alt={fileName} className="w-full h-full object-cover" />
          )
        ) : fileName.match(/\.(pdf)$/i) ? (
          <div className="absolute inset-0 bg-gradient-to-br from-red-700/20 to-red-900/20 flex flex-col items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16 text-red-500/80 mb-2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M10 12v6" /><path d="M14 12v6" /><path d="M10 15h4" /></svg>
            <span className="text-white/60 font-bold tracking-wider">PDF</span>
          </div>
        ) : fileName.match(/\.(ppt|pptx)$/i) ? (
          <div className="absolute inset-0 bg-gradient-to-br from-orange-700/20 to-red-900/20 flex flex-col items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16 text-orange-500/80 mb-2"><path d="M2 3h20" /><path d="M21 3m-1 12h-4L21 12z" /><path d="m12 15 3 6" /><path d="m12 15-3 6" /><rect width="16" height="12" x="4" y="3" rx="2" /></svg>
            <span className="text-white/60 font-bold tracking-wider">PRESENTATION</span>
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-t from-red-900/10 to-transparent flex flex-col items-center justify-center">
            <h3 className="text-xl font-black italic tracking-wider text-white/50 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
              NO THUMBNAIL
            </h3>
          </div>
        )}
      </div>

      {/* File Name Header/Overlay */}
      <div className="absolute bottom-0 w-full p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-xs font-medium text-white truncate px-1 text-center">
          {fileName}
        </p>
      </div>
    </div>
  );
}
