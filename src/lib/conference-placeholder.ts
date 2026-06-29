/** Deterministic accent pair from conference title for placeholder banners. */
export function conferencePlaceholderGradient(title: string): { from: string; to: string } {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  const hue2 = (hue + 40) % 360;
  return {
    from: `hsl(${hue} 62% 38%)`,
    to: `hsl(${hue2} 55% 22%)`,
  };
}

export function conferenceMonogram(title: string): string {
  return (
    title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "MUN"
  );
}
