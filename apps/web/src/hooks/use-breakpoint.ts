import { useMediaQuery } from '@/hooks/use-media-query';

export function useBreakpoint() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isTablet = !isMobile && !isDesktop;

  return {
    isMobile,
    isTablet,
    isDesktop,
  };
}