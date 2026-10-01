import { Link } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/feedback';
import { CertificationStatusBadge } from '@/components/certification-status-badge';
import type { ExpirationItem } from '@/types/entities';
import { formatDate, formatDaysRemaining } from '@/utils/labels';

export function UpcomingExpirations({ items }: { items: ExpirationItem[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Próximos vencimentos</CardTitle>
        <CardDescription>
          Certificações em vigor, ordenadas pela data mais próxima.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {items.length === 0 ? (
          <EmptyState
            title="Nenhum vencimento próximo"
            description="Não há certificações em vigor com data de expiração."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profissional</TableHead>
                <TableHead>Certificação</TableHead>
                <TableHead>Vence em</TableHead>
                <TableHead>Restante</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={`${item.professionalId}-${item.certificationName}-${item.expiresAt}`}>
                  <TableCell>
                    <Link
                      to={`/profissionais/${item.professionalId}`}
                      className="font-medium text-slate-900 hover:text-blue-700 hover:underline dark:text-slate-100 dark:hover:text-blue-400"
                    >
                      {item.professionalName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="text-slate-700 dark:text-slate-300">
                      {item.certificationName}
                    </div>
                    <div className="text-xs text-slate-400">{item.vendorName}</div>
                  </TableCell>
                  <TableCell>{formatDate(item.expiresAt)}</TableCell>
                  <TableCell>{formatDaysRemaining(item.daysRemaining)}</TableCell>
                  <TableCell>
                    <CertificationStatusBadge status={item.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
