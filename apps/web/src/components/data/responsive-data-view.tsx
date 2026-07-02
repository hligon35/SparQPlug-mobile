import { useMediaQuery } from '@/hooks/use-media-query';

interface ResponsiveDataViewProps<T> {
  items: T[];
  renderMobile: (items: T[]) => React.ReactNode;
  renderDesktop: (items: T[]) => React.ReactNode;
}

export function ResponsiveDataView<T>({ items, renderMobile, renderDesktop }: ResponsiveDataViewProps<T>) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  return <>{isMobile ? renderMobile(items) : renderDesktop(items)}</>;
}