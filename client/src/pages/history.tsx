import { useReports, useDeleteReport } from "@/hooks/use-reports";
import { LayoutShell } from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import { Search, Trash2, Loader2, Video } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function History() {
  const { data: reports, isLoading } = useReports();
  const deleteMutation = useDeleteReport();
  const [searchTerm, setSearchTerm] = useState("");
  const [reportToDelete, setReportToDelete] = useState<number | null>(null);

  if (isLoading) {
    return (
      <LayoutShell>
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </LayoutShell>
    );
  }

  const filteredReports = reports?.filter(report =>
    report.originalFilename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.predictedNumberPlate?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <LayoutShell>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Case History</h1>
          <p className="text-muted-foreground">Archive of all processed image evidence.</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search filename or plate..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader className="bg-muted/30 border-b border-border">
          <CardTitle className="text-lg">Records</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-semibold">
                <tr>
                  <th className="px-6 py-4">Evidence</th>
                  <th className="px-6 py-4">Filename</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Detected Plate</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredReports?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      No records found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredReports?.map((report) => (
                    <tr key={report.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="w-12 h-12 rounded bg-muted border border-border overflow-hidden flex items-center justify-center">
                          {report.analysisType === "video" ? (
                            <Video className="w-6 h-6 text-primary" />
                          ) : (
                            <img src={report.imageUrl || ""} alt="Thumbnail" className="w-full h-full object-cover" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium">{report.originalFilename}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={report.status} />
                      </td>
                      <td className="px-6 py-4">
                        {report.predictedNumberPlate ? (
                          <code className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded border border-yellow-200 font-bold">
                            {report.predictedNumberPlate}
                          </code>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {report.createdAt ? new Date(report.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                          timeZone: 'Asia/Kolkata'
                        }) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/report/${report.id}`}>
                            <Button size="sm" variant="outline">View Report</Button>
                          </Link>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setReportToDelete(report.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Evidence?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the report and the associated image data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setReportToDelete(null)}>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={async () => {
                                    if (reportToDelete) {
                                      await deleteMutation.mutateAsync(reportToDelete);
                                      setReportToDelete(null);
                                    }
                                  }}
                                  disabled={deleteMutation.isPending}
                                >
                                  {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </LayoutShell>
  );
}
