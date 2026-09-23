interface NotificationItemProps {
  icon: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  onClick?: () => void;
}

export default function NotificationItem({
  icon,
  title,
  message,
  time,
  read,
  onClick,
}: NotificationItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-background-100"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          read ? "bg-background-200 text-foreground-500" : "bg-primary-100 text-primary-700"
        }`}
      >
        <i className={`${icon} text-lg`} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4
            className={`text-sm font-medium ${
              read ? "text-foreground-700" : "text-foreground-950"
            }`}
          >
            {title}
          </h4>
          {!read && (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-500" />
          )}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-foreground-500">
          {message}
        </p>
        <p className="mt-1 text-[11px] text-foreground-400">{time}</p>
      </div>
    </button>
  );
}