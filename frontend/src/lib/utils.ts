const AVATAR_COLORS = ["#ff3d00", "#00d9ff", "#c4ff00", "#C96442", "#6B8E5A", "#C39A3F"];

export function getAvatarColor(username: string): string {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}
