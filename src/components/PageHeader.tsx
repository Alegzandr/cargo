import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}): JSX.Element {
  return (
    <div className="px-8 py-6 border-b border-hairline flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[20px] font-semibold text-ink leading-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-muted mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function PageBody({ children }: { children: ReactNode }): JSX.Element {
  return <div className="px-8 py-8">{children}</div>;
}
