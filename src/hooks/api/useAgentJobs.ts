import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AgentJobService, type AgentJobQuery } from '@/services/agent-job.service';
import { getApiErrorMessage } from '@/utils/api-error';
import type { AgentJob, CreateAgentJobDto, UpdateAgentJobDto } from '@/types/api.types';
import { message } from 'antd';

const AGENT_JOBS_KEY = 'agent-jobs';

export const useAgentJobs = (params?: AgentJobQuery, enabled = true) => {
  return useQuery<AgentJob[], Error>({
    queryKey: [AGENT_JOBS_KEY, params],
    queryFn: () => AgentJobService.getAll(params),
    enabled,
    placeholderData: (previous) => previous,
  });
};

export const useAgentJobsByAgent = (agentId: string | undefined, enabled = true) => {
  return useQuery<AgentJob[], Error>({
    queryKey: [AGENT_JOBS_KEY, 'by-agent', agentId],
    queryFn: () => AgentJobService.getByAgent(agentId as string),
    enabled: !!agentId && enabled,
  });
};

export const useCreateAgentJob = () => {
  const queryClient = useQueryClient();

  return useMutation<AgentJob, Error, CreateAgentJobDto>({
    mutationFn: (data) => AgentJobService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AGENT_JOBS_KEY] });
      message.success('تمت إضافة وظيفة الوكيل بنجاح / Agent job created successfully');
    },
    onError: (error: any) => {
      message.error(getApiErrorMessage(error, 'فشل إضافة وظيفة الوكيل / Failed to create agent job'));
    },
  });
};

export const useUpdateAgentJob = () => {
  const queryClient = useQueryClient();

  return useMutation<AgentJob, Error, UpdateAgentJobDto>({
    mutationFn: (data) => AgentJobService.update(data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AGENT_JOBS_KEY] });
      message.success('تم تحديث وظيفة الوكيل بنجاح / Agent job updated successfully');
    },
    onError: (error: any) => {
      message.error(getApiErrorMessage(error, 'فشل تحديث وظيفة الوكيل / Failed to update agent job'));
    },
  });
};

export const useDeleteAgentJob = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => AgentJobService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AGENT_JOBS_KEY] });
      message.success('تم حذف وظيفة الوكيل بنجاح / Agent job deleted successfully');
    },
    onError: (error: any) => {
      message.error(getApiErrorMessage(error, 'فشل حذف وظيفة الوكيل / Failed to delete agent job'));
    },
  });
};
