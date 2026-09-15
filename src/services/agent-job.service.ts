import { api } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/config/api.config';
import type {
  AgentJob,
  CreateAgentJobDto,
  UpdateAgentJobDto,
  ResolveAgentJobDto,
  ResolveAgentJobResult,
} from '@/types/api.types';

/**
 * Optional server-side filters for GET /api/V1/AgentJob.
 */
export interface AgentJobQuery {
  agentId?: string;
  jobId?: string;
  isActive?: boolean;
}

export class AgentJobService {
  private static normalizeKeys<T extends Record<string, any>>(item: T): T {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;

    return Object.entries(item).reduce<Record<string, any>>((acc, [key, value]) => {
      acc[key] = value;
      acc[key.charAt(0).toLowerCase() + key.slice(1)] = value;
      return acc;
    }, {}) as T;
  }

  private static normalizeAgentJob(item: any): AgentJob {
    const job = this.normalizeKeys(item);
    return {
      ...job,
      id: job.id ?? job.ID,
      agentId: job.agentId ?? job.agentID,
      jobId: job.jobId ?? job.jobID,
    } as AgentJob;
  }

  private static unwrap<T>(payload: any): T {
    return this.normalizeKeys(payload?.data?.value ?? payload?.value ?? payload?.data ?? payload) as T;
  }

  private static unwrapList<T>(payload: any): T[] {
    const candidates = [
      payload,
      payload?.data,
      payload?.data?.value,
      payload?.value,
      payload?.result,
      payload?.data?.result,
      payload?.items,
      payload?.data?.items,
      payload?.value?.items,
      payload?.data?.value?.items,
      payload?.records,
      payload?.data?.records,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate.map((item) => this.normalizeAgentJob(item)) as T[];
      if (Array.isArray(candidate?.$values)) {
        return candidate.$values.map((item: any) => this.normalizeAgentJob(item)) as T[];
      }
    }

    console.warn('[AgentJobService] Unexpected response shape:', payload);
    return [];
  }

  static async getAll(params?: AgentJobQuery): Promise<AgentJob[]> {
    const query: Record<string, any> = { PageSize: 9999, PageNumber: 1 };
    if (params?.agentId != null) query.agentId = params.agentId;
    if (params?.jobId != null) query.jobId = params.jobId;
    if (params?.isActive != null) query.isActive = params.isActive;

    const response = await api.get<any>(API_ENDPOINTS.AGENT_JOB.GET_ALL, { params: query });
    return this.unwrapList<AgentJob>(response.data);
  }

  static async getByAgent(agentId: string): Promise<AgentJob[]> {
    const response = await api.get<any>(API_ENDPOINTS.AGENT_JOB.BY_AGENT(agentId));
    return this.unwrapList<AgentJob>(response.data);
  }

  static async getById(id: string): Promise<AgentJob> {
    const response = await api.get<any>(API_ENDPOINTS.AGENT_JOB.GET_BY_ID(id));
    return this.unwrap<AgentJob>(response.data);
  }

  static async create(data: CreateAgentJobDto): Promise<AgentJob> {
    const payload = {
      agentId: data.agentId,
      jobId: data.jobId,
      workerType: data.workerType != null ? Number(data.workerType) : null,
      previousExperience: data.previousExperience != null ? Number(data.previousExperience) : null,
      cost: Number(data.cost) || 0,
      alternativeCost: data.alternativeCost != null ? Number(data.alternativeCost) : 0,
      percentAfterSelection: Number(data.percentAfterSelection) || 0,
      percentAfterVisa: Number(data.percentAfterVisa) || 0,
      percentAfterArrival: Number(data.percentAfterArrival) || 0,
      notes: data.notes ?? null,
      isActive: data.isActive ?? true,
    };
    const response = await api.post<any>(API_ENDPOINTS.AGENT_JOB.CREATE, payload);
    return this.unwrap<AgentJob>(response.data);
  }

  static async update(id: string, data: UpdateAgentJobDto): Promise<AgentJob> {
    const payload = {
      id,
      agentId: data.agentId,
      jobId: data.jobId,
      workerType: data.workerType != null ? Number(data.workerType) : null,
      previousExperience: data.previousExperience != null ? Number(data.previousExperience) : null,
      cost: Number(data.cost) || 0,
      alternativeCost: data.alternativeCost != null ? Number(data.alternativeCost) : 0,
      percentAfterSelection: Number(data.percentAfterSelection) || 0,
      percentAfterVisa: Number(data.percentAfterVisa) || 0,
      percentAfterArrival: Number(data.percentAfterArrival) || 0,
      notes: data.notes ?? null,
      isActive: data.isActive ?? true,
    };
    const response = await api.put<any>(API_ENDPOINTS.AGENT_JOB.UPDATE(id), payload);
    return this.unwrap<AgentJob>(response.data);
  }

  static async delete(id: string): Promise<void> {
    await api.delete(API_ENDPOINTS.AGENT_JOB.DELETE(id));
  }

  /** Optional preview-match helper — not required on the offer screen. */
  static async resolve(data: ResolveAgentJobDto): Promise<ResolveAgentJobResult> {
    const payload = {
      agentId: data.agentId,
      jobId: data.jobId,
      workerType: data.workerType ?? null,
      previousExperience: data.previousExperience ?? null,
      useAlternativeCost: data.useAlternativeCost ?? false,
    };
    const response = await api.post<any>(API_ENDPOINTS.AGENT_JOB.RESOLVE, payload);
    return this.unwrap<ResolveAgentJobResult>(response.data);
  }
}
