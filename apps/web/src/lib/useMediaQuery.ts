import { useEffect, useState } from "react";

export const DESKTOP_QUERY = "(min-width: 768px)";

/** Sleduje media query (např. šířku displeje) a překreslí při změně. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    media.addEventListener("change", onChange);
    onChange();
    return () => media.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}
