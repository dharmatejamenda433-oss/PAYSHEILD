import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  const { user } = useAuth();

  const home = user?.role === 'admin' ? '/admin' : '/dashboard';

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-lg p-8 text-center sm:p-10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Compass className="h-7 w-7" />
        </span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          404
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          This page is not on the map
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          The route you opened does not exist, or you may not have access to it
          with your current role.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button as={Link} to={home} icon={ArrowLeft}>
            Back to {user?.role === 'admin' ? 'admin console' : 'dashboard'}
          </Button>
          <Button as={Link} to="/transactions" variant="secondary">
            View transactions
          </Button>
        </div>
      </Card>
    </div>
  );
}
