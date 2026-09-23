interface TimelineItemProps {
  icon: string;
  title: string;
  time: string;
}

export default function TimelineItem({ icon, title, time }: TimelineItemProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <i className={`${icon} text-sm`} />
        </span>
        <div className="mt-1 h-full min-h-[24px] w-px bg-background-200" />
      </div>
      <div className="pb-4">
        <p className="text-sm font-medium text-foreground-800">{title}</p>
        <p className="mt-0.5 text-xs text-foreground-400">{time}</p>
      </div>
    </div>
  );
}