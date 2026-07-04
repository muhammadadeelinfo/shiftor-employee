export const getStartupRoute = (hasUser: boolean) =>
  hasUser ? '/home' : '/startup';
