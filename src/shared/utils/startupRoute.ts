export const getStartupRoute = (hasUser: boolean) =>
  hasUser ? '/my-shifts' : '/startup';
