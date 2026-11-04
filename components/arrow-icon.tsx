export type ArrowDirection = "right" | "diagonal" | "down" | "down-left" | "up";

type ArrowIconProps = {
  direction?: ArrowDirection;
  className?: string;
  size?: number;
};

export function ArrowIcon({ direction = "right", className = "", size = 24 }: ArrowIconProps) {
  const classes = ["arrow-icon", direction !== "right" && `arrow-icon--${direction}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <svg className={classes} viewBox="0 0 32 32" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 16h22M17 5l10 11-10 11" />
    </svg>
  );
}

export default ArrowIcon;
