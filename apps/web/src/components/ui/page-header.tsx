import type { VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { pageHeaderClassName } from './page-header.styles';

export function PageHeader({
  title,
  description,
  actions,
  divider,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
} & VariantProps<typeof pageHeaderClassName>) {
  return (
    <header className={pageHeaderClassName({ divider })}>
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}
