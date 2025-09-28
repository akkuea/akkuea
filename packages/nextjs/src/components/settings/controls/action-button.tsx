export interface ActionButtonProps {
  onClick: () => void;
  label: string;
  isDanger?: boolean;
}

export function ActionButton({ onClick, label, isDanger = false }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={
        isDanger
          ? 'px-4 py-2 rounded bg-destructive/10 hover:bg-destructive/20 text-destructive'
          : 'px-4 py-2 rounded bg-muted hover:bg-muted/80 text-foreground'
      }
    >
      {label}
    </button>
  );
}
