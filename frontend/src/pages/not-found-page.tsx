import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/feedback';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <Card>
      <EmptyState
        title="Página não encontrada"
        description="O endereço acessado não existe."
        action={
          <Link to="/">
            <Button variant="outline" size="sm">
              Voltar ao Dashboard
            </Button>
          </Link>
        }
      />
    </Card>
  );
}
