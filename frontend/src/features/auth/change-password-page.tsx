import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { LoadingState } from '@/components/feedback';
import { useAuth } from '@/hooks/use-auth';
import { extractApiError } from '@/services/api';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: z.string().min(8, 'A nova senha deve ter ao menos 8 caracteres'),
    confirmPassword: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export function ChangePasswordPage() {
  const { user, loading, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingState label="Verificando sessão..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const onSubmit = async (values: FormValues): Promise<void> => {
    setServerError(null);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      navigate('/', { replace: true });
    } catch (error) {
      setServerError(extractApiError(error));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Definir nova senha
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {user.mustChangePassword
              ? 'Sua senha é provisória. Crie uma nova para continuar.'
              : 'Atualize a sua senha de acesso.'}
          </p>
        </div>

        <Card className="p-6">
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            {serverError && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Senha atual</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                {...register('currentPassword')}
              />
              {errors.currentPassword && (
                <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                  {errors.currentPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Nova senha</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo de 8 caracteres"
                {...register('newPassword')}
              />
              {errors.newPassword && (
                <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                  {errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting && <Spinner className="h-4 w-4 text-white" />}
              Salvar nova senha
            </Button>
          </form>
        </Card>

        <button
          type="button"
          onClick={() => void logout()}
          className="mt-4 block w-full text-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
