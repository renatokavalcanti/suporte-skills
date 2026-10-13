import { api } from './api';
import type { Paginated } from '@/types/entities';
import type { BalancePolicy, Contract } from '@/types/reports';

export interface ContractListParams {
  page?: number;
  pageSize?: number;
  clientId?: string;
  search?: string;
  active?: boolean;
}

export interface ContractPayload {
  clientId: string;
  planName: string;
  includedMinutes: number;
  monthlyValue: number;
  extraHourValue: number;
  balancePolicy: BalancePolicy;
  startDate: string;
  endDate?: string;
  financeEmail?: string;
  active?: boolean;
}

export const contractsService = {
  async list(params: ContractListParams): Promise<Paginated<Contract>> {
    const { data } = await api.get<Paginated<Contract>>('/contracts', { params });
    return data;
  },
  async create(payload: ContractPayload): Promise<Contract> {
    const { data } = await api.post<Contract>('/contracts', payload);
    return data;
  },
  async update(
    id: string,
    payload: Partial<ContractPayload>,
  ): Promise<Contract> {
    const { data } = await api.put<Contract>(`/contracts/${id}`, payload);
    return data;
  },
  async setActive(id: string, active: boolean): Promise<Contract> {
    const { data } = await api.patch<Contract>(`/contracts/${id}/status`, {
      active,
    });
    return data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/contracts/${id}`);
  },
};
