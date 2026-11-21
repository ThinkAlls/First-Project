export function GeometricDivider({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-4 my-8 ${className}`} aria-hidden="true">
      <div className="h-px flex-1 bg-[#E4DFD3]" />
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#B48A3E] shrink-0">
        <polygon
          points="12,2 15,9 22,12 15,15 12,22 9,15 2,12 9,9"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <rect
          x="7"
          y="7"
          width="10"
          height="10"
          transform="rotate(45 12 12)"
          stroke="currentColor"
          strokeWidth="1"
          strokeOpacity="0.6"
        />
      </svg>
      <div className="h-px flex-1 bg-[#E4DFD3]" />
    </div>
  );
}
