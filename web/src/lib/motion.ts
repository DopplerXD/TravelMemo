const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * MapLibre camera helpers accept `duration: 0`, which jumps instead of flying.
 * Honouring the OS preference keeps long cross-country flights from becoming a
 * vestibular trigger without removing the resulting view change.
 */
export function mapDuration(duration: number): number {
  return prefersReducedMotion() ? 0 : duration;
}
