import { LogOut, Menu, Moon, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { roleLabels } from '@/utils/labels';

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Abrir menu"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Gestão da capacidade técnica da equipe
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Alternar tema"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        {user && (
          <Link
            to={`/profissionais/${user.id}`}
            className="hidden items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-100 sm:flex dark:hover:bg-slate-800"
          >
            <div className="text-right leading-tight">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {user.name}
              </p>
              <p className="text-[11px] text-slate-400">
                {roleLabels[user.role] ?? user.role}
              </p>
            </div>
            <Badge variant="info">{roleLabels[user.role] ?? user.role}</Badge>
          </Link>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => void logout()}
          aria-label="Sair"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </div>
    </header>
  );
}
