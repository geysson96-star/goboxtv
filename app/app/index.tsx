import { Redirect } from 'expo-router';
import { useAuth } from '../src/store/auth';

export default function Index() {
  const status = useAuth((s) => s.status);
  return <Redirect href={status === 'in' ? '/home' : '/login'} />;
}
