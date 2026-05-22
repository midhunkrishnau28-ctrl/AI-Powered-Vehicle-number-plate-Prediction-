import { useState, useRef } from "react";
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { LayoutShell } from "@/components/layout-shell";
import { ImageUploadDropzone } from "@/components/image-upload-dropzone";
import { useCreateReport } from "@/hooks/use-reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Zap, Shield, FileSearch, RotateCcw, Crop as CropIcon } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function NewAnalysis() {
  const [image, setImage] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  const createReport = useCreateReport();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const crop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        16 / 9,
        width,
        height
      ),
      width,
      height
    );
    setCrop(crop);
  }

  const getCroppedImg = (image: HTMLImageElement, crop: PixelCrop) => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width * scaleX;
    canvas.height = crop.height * scaleY;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY
    );

    return canvas.toDataURL('image/jpeg');
  };

  const handleAnalyze = async () => {
    if (!image) return;

    try {
      let imagePayload = image;

      if (completedCrop && imgRef.current && completedCrop.width > 0 && completedCrop.height > 0) {
        // Use cropped image if available and valid
        imagePayload = getCroppedImg(imgRef.current, completedCrop);
      }

      const result = await createReport.mutateAsync({
        image: imagePayload,
        filename
      });
      setLocation(`/report/${result.id}`);
    } catch (error) {
      // Error handled in hook
      console.error(error);
    }
  };

  return (
    <LayoutShell>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold mb-2">Image Analysis</h1>
          <p className="text-muted-foreground">Upload vehicle imagery for license plate extraction and enhancement.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-md border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSearch className="w-5 h-5 text-primary" />
                  Upload Evidence
                </CardTitle>
                <CardDescription>Supported formats: JPG, PNG. Max size: 5MB.</CardDescription>
              </CardHeader>
              <CardContent>
                {!image ? (
                  <ImageUploadDropzone
                    onImageSelected={(base64, name) => {
                      setImage(base64);
                      setFilename(name);
                    }}
                    isProcessing={createReport.isPending}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="bg-black/5 rounded-lg p-4 border border-border flex justify-center overflow-hidden">
                      <ReactCrop
                        crop={crop}
                        onChange={(_, percentCrop) => setCrop(percentCrop)}
                        onComplete={(c) => setCompletedCrop(c)}
                        className="max-h-[500px]"
                      >
                        <img
                          ref={imgRef}
                          alt="Upload"
                          src={image}
                          onLoad={onImageLoad}
                          className="max-w-full object-contain"
                        />
                      </ReactCrop>
                    </div>

                    <div className="flex items-center justify-between text-sm text-muted-foreground bg-blue-50 dark:bg-blue-900/10 p-3 rounded text-blue-700 dark:text-blue-300">
                      <div className="flex items-center gap-2">
                        <CropIcon className="w-4 h-4" />
                        <span>Drag to select the specific area (e.g. License Plate)</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setImage(null);
                          setFilename("");
                          setCrop(undefined);
                        }}
                        className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Reset
                      </Button>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <Button
                    size="lg"
                    onClick={handleAnalyze}
                    disabled={!image || createReport.isPending}
                    className="w-full md:w-auto shadow-lg shadow-primary/25"
                  >
                    {createReport.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing Evidence...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2 fill-current" />
                        Run Analysis
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-primary/5 border-primary/10">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  System Capabilities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-primary text-sm">1</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Plate Detection</h4>
                    <p className="text-xs text-muted-foreground mt-1">Automatically locates vehicle registration plates within complex scenes.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-primary text-sm">2</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">AI Enhancement</h4>
                    <p className="text-xs text-muted-foreground mt-1">Removes blur and improves contrast to reveal hidden details.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-primary text-sm">3</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">OCR Extraction</h4>
                    <p className="text-xs text-muted-foreground mt-1">Converts visual text into searchable database records.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </LayoutShell>
  );
}
