import { useReport } from "@/hooks/use-reports";
import { LayoutShell } from "@/components/layout-shell";
import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { ArrowLeft, Printer, Share2, ZoomIn, FileText, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// Client-side OCR confusion matrices — letters and digits kept strictly separate
// so generated alternatives always follow Indian plate format (e.g. KL 07 BX 1234)
const LETTER_CONFUSIONS: Record<string, string[]> = {
  "O": ["D", "Q"],  "D": ["O", "B"],  "Q": ["O", "G"],
  "I": ["L", "T"],  "L": ["I", "T"],  "T": ["I", "L"],
  "B": ["P", "R"],  "P": ["R", "F"],  "R": ["P", "K"],  "F": ["E", "P"],
  "E": ["F"],       "S": ["G", "Z"],  "Z": ["S"],
  "G": ["C", "S"],  "C": ["G", "O"],
  "U": ["V"],       "V": ["U", "Y"],  "Y": ["V"],
  "H": ["N", "M"],  "M": ["N", "H"],  "N": ["H", "M"],
  "K": ["X", "R"],  "X": ["K"],       "A": ["H"],
};

const DIGIT_CONFUSIONS: Record<string, string[]> = {
  "0": ["8", "6"],  "8": ["0", "3"],  "6": ["0", "8", "5"],
  "1": ["7"],       "7": ["1"],
  "2": ["7", "3"],  "3": ["8", "2"],
  "4": ["9", "1"],  "9": ["4", "8"],
  "5": ["6"],
};

function generateAlternatives(
  plate: string,
  max = 5
): { plate: string; score: number; reason: string }[] {
  if (!plate || plate === "Unknown") return [];
  const upper = plate.toUpperCase();
  const norm = upper.replace(/\s/g, "");
  const seen = new Set<string>([norm]);
  const results: { plate: string; score: number; reason: string }[] = [];

  for (let i = 0; i < upper.length && results.length < max; i++) {
    const ch = upper[i];
    if (ch === " ") continue; // keep spaces intact

    // Pick the right table: digit positions only get digit alternatives and vice versa
    const isDigitChar = ch >= "0" && ch <= "9";
    const alts = isDigitChar ? DIGIT_CONFUSIONS[ch] : LETTER_CONFUSIONS[ch];
    if (!alts) continue;

    for (const alt of alts) {
      if (results.length >= max) break;
      const variant = upper.slice(0, i) + alt + upper.slice(i + 1);
      const variantNorm = variant.replace(/\s/g, "");
      if (!seen.has(variantNorm)) {
        seen.add(variantNorm);
        const score = parseFloat((Math.max(0.30, 0.88 - results.length * 0.06)).toFixed(2));
        results.push({ plate: variant, score, reason: `'${ch}' misread as '${alt}' (visual similarity)` });
      }
    }
  }
  return results;
}

// Digit→Letter for series position, Letter→Digit for number/district positions
const D2L: Record<string, string> = {
  "0": "O", "1": "I", "2": "Z", "3": "B",
  "4": "A", "5": "S", "6": "G", "7": "T", "8": "B", "9": "P",
};
const L2D: Record<string, string> = {
  "O": "0", "I": "1", "L": "1", "Z": "2", "S": "5",
  "G": "6", "T": "7", "B": "8", "A": "4",
};

/**
 * Detects and fixes Indian plate format errors:
 * State(LL) District(DD) Series(LL) Number(NNNN)
 * e.g. "KL 10 24 2840" → "KL 10 ZA 2840" (24→ZA because series must be letters)
 */
function correctIndianPlateFormat(plate: string): string {
  if (!plate || plate === "Unknown") return plate;
  const stripped = plate.replace(/\s/g, "").toUpperCase();
  if (stripped.length < 8 || stripped.length > 10) return plate;

  const state  = stripped.slice(0, 2);
  const dist   = stripped.slice(2, 4);
  const regNum = stripped.slice(-4);
  const series = stripped.slice(4, stripped.length - 4);

  const fixedState  = state.split("").map(ch => (ch >= "0" && ch <= "9") ? (D2L[ch] ?? ch) : ch).join("");
  const fixedDist   = dist.split("").map(ch => !(ch >= "0" && ch <= "9") ? (L2D[ch] ?? ch) : ch).join("");
  const fixedSeries = series.split("").map(ch => (ch >= "0" && ch <= "9") ? (D2L[ch] ?? ch) : ch).join("");
  const fixedReg    = regNum.split("").map(ch => !(ch >= "0" && ch <= "9") ? (L2D[ch] ?? ch) : ch).join("");

  const changed = fixedState !== state || fixedDist !== dist || fixedSeries !== series || fixedReg !== regNum;
  if (!changed) return plate;
  return `${fixedState} ${fixedDist} ${fixedSeries} ${fixedReg}`;
}


export default function ReportDetails() {
  const [, params] = useRoute("/report/:id");
  const id = parseInt(params?.id || "0");
  const { data: report, isLoading, error } = useReport(id);
  const { toast } = useToast();

  // Correct and build the plate display value
  const rawPlate = report?.predictedNumberPlate || "";
  const primaryPlate = correctIndianPlateFormat(rawPlate) || rawPlate;

  // A plate is "partial" if it's too short to be a real Indian plate (< 6 alphanum chars)
  // In that case we NEVER show alternatives — they'd be meaningless single characters
  const strippedLen = primaryPlate.replace(/\s/g, "").length;
  const isPartialPlate = strippedLen > 0 && strippedLen < 6;

  // Build the alternatives list only for full plates
  const storedCandidates = (report?.candidates as any[] | null) ?? [];
  const filteredStored = isPartialPlate ? [] : storedCandidates
    .map((c: any) => ({ ...c, plate: correctIndianPlateFormat(c.plate) || c.plate }))
    .filter((c: any) => c.plate?.toUpperCase().replace(/\s/g, "") !== primaryPlate.toUpperCase().replace(/\s/g, ""));
  const alternatives = (!isPartialPlate && filteredStored.length > 0)
    ? filteredStored
    : (!isPartialPlate ? generateAlternatives(primaryPlate) : []);


  const handleShare = async () => {
    const shareData = {
      title: `Intelligence Wing Report #${report?.id}`,
      text: `Vehicle Analysis Report for plate: ${report?.predictedNumberPlate || 'Unknown'}`,
      url: window.location.href,
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Link Copied",
          description: "The report link has been copied to your clipboard.",
        });
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Link Copied",
          description: "The report link has been copied to your clipboard.",
        });
      }
    }
  };

  if (isLoading) {
    return (
      <LayoutShell>
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </LayoutShell>
    );
  }

  if (error || !report) {
    return (
      <LayoutShell>
        <div className="max-w-md mx-auto mt-20 text-center">
          <h2 className="text-xl font-bold text-destructive mb-2">Error Loading Report</h2>
          <p className="text-muted-foreground mb-6">The requested analysis could not be found or access is denied.</p>
          <Link href="/history">
            <Button>Return to History</Button>
          </Link>
        </div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/history">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Analysis Report #{report.id}</h1>
              <StatusBadge status={report.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              Generated on {report.createdAt ? new Date(report.createdAt).toLocaleString('en-IN', {
                dateStyle: 'long',
                timeStyle: 'medium',
                timeZone: 'Asia/Kolkata'
              }) + ' (IST)' : 'Unknown'} • Ref: KP-IA-{report.id}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Image View */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="overflow-hidden border-2 border-border shadow-lg">
              <CardHeader className="bg-muted/30 border-b border-border py-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ZoomIn className="w-4 h-4" />
                  Evidence Imagery
                </CardTitle>
              </CardHeader>
              <div className="relative bg-black/95 aspect-video flex items-center justify-center min-h-[400px]">
                {report.analysisType === "video" ? (
                  <video
                    src={report.videoUrl || ""}
                    controls
                    className="w-full h-full object-contain shadow-sm rounded"
                  />
                ) : (
                  <img
                    src={report.imageUrl || ""}
                    alt="Evidence"
                    className="w-full h-full object-contain shadow-sm rounded"
                  />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Detailed Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none text-muted-foreground">
                  {report.analysisResult ? (
                    <div className="whitespace-pre-wrap">{report.analysisResult}</div>
                  ) : (
                    <p className="italic">Analysis is pending or returned no detailed results.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Details */}
          <div className="space-y-6">
            <Card className="bg-primary text-primary-foreground border-none shadow-xl shadow-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg opacity-90">Detection Result</CardTitle>
              </CardHeader>
              <CardContent>
                {report.predictedNumberPlate ? (
                  <>
                    <div className="text-center p-4 bg-white/10 rounded-lg backdrop-blur-sm border border-white/20">
                      <p className="text-xs uppercase tracking-widest opacity-70 mb-1">License Plate</p>
                      <div className={`font-mono font-black tracking-wider text-yellow-400 drop-shadow-md ${isPartialPlate ? 'text-4xl opacity-60' : 'text-3xl'}`}>
                        {primaryPlate}
                      </div>
                      <p className="text-xs opacity-50 mt-1 uppercase tracking-widest">
                        {isPartialPlate ? '⚠ Partial Detection' : 'Best Match'}
                      </p>
                    </div>

                    {isPartialPlate && (
                      <div className="mt-3 p-3 bg-yellow-400/10 border border-yellow-400/30 rounded-lg">
                        <p className="text-xs text-yellow-300 text-center leading-relaxed">
                          🔍 Only a fragment of the plate was detected. The image may be too blurry or the plate not fully visible. Please try a clearer image.
                        </p>
                      </div>
                    )}

                    {!isPartialPlate && alternatives.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                        <p className="text-xs uppercase tracking-widest opacity-70 mb-2">⚠ Possible Alternatives</p>
                        <div className="space-y-2">
                          {alternatives.slice(0, 5).map((c: any, i: number) => (
                            <div key={i} className="text-sm px-3 py-2 bg-white/5 rounded-lg backdrop-blur-sm border border-white/10 shadow-sm space-y-1">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold bg-white/10 rounded-full w-5 h-5 flex items-center justify-center opacity-60">
                                    {i + 2}
                                  </span>
                                  <span className="font-mono text-yellow-200/90 font-bold tracking-wider">{c.plate}</span>
                                </div>
                                <span className="text-xs font-mono opacity-70 bg-black/30 px-2 py-0.5 rounded">
                                  {(c.score * 100).toFixed(0)}%
                                </span>
                              </div>
                              {/* Confidence bar */}
                              <div className="w-full bg-white/10 rounded-full h-1">
                                <div
                                  className="bg-yellow-400/60 h-1 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, c.score * 100)}%` }}
                                />
                              </div>
                              {c.reason && (
                                <p className="text-[10px] opacity-50 italic">{c.reason}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center p-4 bg-white/5 rounded-lg border border-white/10">
                    <p className="opacity-70">No plate detected</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium uppercase text-muted-foreground">Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Original Filename</label>
                  <p className="font-medium font-mono text-sm truncate" title={report.originalFilename}>
                    {report.originalFilename}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Processing Status</label>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={report.status} />
                    {report.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Investigating Officer</label>
                  <p className="font-medium text-sm">ID: {report.userId?.slice(0, 8)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </LayoutShell>
  );
}
