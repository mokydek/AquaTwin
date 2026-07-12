import { useEffect } from 'react'

// Sets the document title for a route and restores the previous one on unmount.
export function usePageTitle(title: string): void {
  useEffect(() => {
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])
}
