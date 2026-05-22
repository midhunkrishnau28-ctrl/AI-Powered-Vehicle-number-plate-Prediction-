import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError, redirectToLogin } from "@/lib/auth-utils";

export function useReports() {
  const { toast } = useToast();

  return useQuery({
    queryKey: [api.reports.list.path],
    queryFn: async () => {
      const res = await fetch(api.reports.list.path, { credentials: "include" });
      if (res.status === 401) {
        redirectToLogin();
        return [];
      }
      if (!res.ok) throw new Error("Failed to fetch reports");
      return api.reports.list.responses[200].parse(await res.json());
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (Array.isArray(data) && data.some(r => r.status === "pending" || r.status === "processing")) {
        return 2000;
      }
      return false;
    },
  });
}

export function useReport(id: number) {
  return useQuery({
    queryKey: [api.reports.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.reports.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 401) {
        redirectToLogin();
        return null;
      }
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch report");
      return api.reports.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === "pending" || data.status === "processing")) {
        return 1000;
      }
      return false;
    },
  });
}

export function useCreateReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { image: string; filename: string }) => {
      const validated = api.reports.create.input.parse(data);
      const res = await fetch(api.reports.create.path, {
        method: api.reports.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (res.status === 401) {
        redirectToLogin(toast);
        throw new Error("Unauthorized");
      }

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.reports.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create report");
      }
      return api.reports.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.reports.list.path] });
      toast({
        title: "Report Created",
        description: "Image analysis has started.",
      });
    },
    onError: (error: Error) => {
      if (!isUnauthorizedError(error)) {
        toast({
          title: "Submission Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.reports.delete.path, { id });
      const res = await fetch(url, {
        method: api.reports.delete.method,
        credentials: "include",
      });

      if (res.status === 401) {
        redirectToLogin(toast);
        throw new Error("Unauthorized");
      }

      if (!res.ok) {
        throw new Error("Failed to delete report");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.reports.list.path] });
      toast({
        title: "Report Deleted",
        description: "The record has been permanently removed.",
      });
    },
    onError: (error: Error) => {
      if (!isUnauthorizedError(error)) {
        toast({
          title: "Deletion Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });
}
export function useCreateVideoReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { video: string; filename: string; frameImage?: string }) => {
      const validated = api.video.create.input.parse(data);
      const res = await fetch(api.video.create.path, {
        method: api.video.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (res.status === 401) {
        redirectToLogin(toast);
        throw new Error("Unauthorized");
      }

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.video.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create video report");
      }
      return api.video.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.reports.list.path] });
      toast({
        title: "Video Uploaded",
        description: "Video forensic analysis has started.",
      });
    },
    onError: (error: Error) => {
      if (!isUnauthorizedError(error)) {
        toast({
          title: "Submission Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });
}
