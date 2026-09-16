/** Gold/silver/bronze prefix for a 1-indexed position, empty for everyone else. */
export function medalEmoji(position: number): string {
  switch (position) {
    case 1:
      return '🏆 '
    case 2:
      return '🥈 '
    case 3:
      return '🥉 '
    default:
      return ''
  }
}
