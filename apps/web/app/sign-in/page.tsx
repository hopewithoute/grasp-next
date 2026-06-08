import type { Metadata } from 'next';
import { SignInPage as SignInPageView, type SignInPageProps } from '@/features/auth/sign-in-page';

export const metadata: Metadata = {
  description: 'Sign in to Grasp, the adaptive learning platform.',
  title: 'Sign In | Grasp',
};

export default function SignInPage(props: SignInPageProps) {
  return <SignInPageView {...props} />;
}
