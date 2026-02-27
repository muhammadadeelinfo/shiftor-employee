export const getStartupRoute = (hasUser: boolean) =>
  hasUser ? '(tabs)/my-shifts' : '/login';
