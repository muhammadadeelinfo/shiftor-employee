import { Redirect } from 'expo-router';

export default function SignupScreenRedirect() {
  return <Redirect href="/login?mode=signup" />;
}
