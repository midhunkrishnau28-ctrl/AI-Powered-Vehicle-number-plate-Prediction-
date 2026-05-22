import { LayoutShell } from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Shield, FileVideo, RotateCcw, Play, UploadCloud, X, File, Loader2, Camera, Crop } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useCreateVideoReport } from "@/hooks/use-reports";
import { useLocation } from "wouter";
import ReactCrop, { type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

export default function VideoAnalysis() {
    const [video, setVideo] = useState<string | null>(null);
    const [filename, setFilename] = useState<string>("");
    const [isDragging, setIsDragging] = useState(false);
    const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
    const [crop, setCrop] = useState<any>({
        unit: '%',
        width: 40,
        height: 30,
        x: 30,
        y: 35
    });
    const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
    const [croppedImage, setCroppedImage] = useState<string | null>(null);
    const [showCropTool, setShowCropTool] = useState(false);

    const createReport = useCreateVideoReport();
    const [, setLocation] = useLocation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    const handleFile = (file: File) => {
        if (!file.type.startsWith("video/")) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            setVideo(result);
            setFilename(file.name);
            setCapturedFrame(null);
            setCroppedImage(null);
            setShowCropTool(false);
        };
        reader.readAsDataURL(file);
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const clearSelection = () => {
        setVideo(null);
        setFilename("");
        setCapturedFrame(null);
        setCroppedImage(null);
        setShowCropTool(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const captureFrame = () => {
        if (!videoRef.current) return;

        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);
            const frameData = canvas.toDataURL('image/jpeg', 0.95);
            setCapturedFrame(frameData);
            setShowCropTool(true);
            setCroppedImage(null);
        }
    };

    const handleCropComplete = (crop: PixelCrop) => {
        setCompletedCrop(crop);
    };

    const cropSelectedRegion = () => {
        if (!capturedFrame || !completedCrop || !imageRef.current) return;

        const canvas = document.createElement('canvas');
        const scaleX = imageRef.current.naturalWidth / imageRef.current.width;
        const scaleY = imageRef.current.naturalHeight / imageRef.current.height;

        canvas.width = completedCrop.width * scaleX;
        canvas.height = completedCrop.height * scaleY;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(
            imageRef.current,
            completedCrop.x * scaleX,
            completedCrop.y * scaleY,
            completedCrop.width * scaleX,
            completedCrop.height * scaleY,
            0,
            0,
            canvas.width,
            canvas.height
        );

        const croppedData = canvas.toDataURL('image/jpeg', 0.95);
        setCroppedImage(croppedData);
        setShowCropTool(false);
    };

    const resetCrop = () => {
        setCroppedImage(null);
        setShowCropTool(true);
    };

    const handleAnalyze = async () => {
        if (!video) return;

        try {
            const result = await createReport.mutateAsync({
                video,
                filename,
                frameImage: croppedImage || capturedFrame || undefined
            });
            setLocation(`/report/${result.id}`);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <LayoutShell>
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center md:text-left">
                    <h1 className="text-3xl font-bold mb-2">Video Investigation</h1>
                    <p className="text-muted-foreground">Upload CCTV footage, select the best frame, and crop the region to analyze.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="shadow-md border-primary/20">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileVideo className="w-5 h-5 text-primary" />
                                    Upload Video Evidence
                                </CardTitle>
                                <CardDescription>Supported formats: MP4, AVI, MKV. Max size: 100MB.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {video ? (
                                    <div className="space-y-4">
                                        {!capturedFrame ? (
                                            <>
                                                <div className="relative rounded-xl overflow-hidden border border-border bg-card shadow-lg group">
                                                    <video
                                                        ref={videoRef}
                                                        src={video}
                                                        controls
                                                        className="w-full h-64 md:h-96 object-contain bg-black"
                                                    />
                                                    <div className="absolute top-2 right-2">
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            className="rounded-full shadow-lg"
                                                            onClick={clearSelection}
                                                            disabled={createReport.isPending}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-900/10 p-3 rounded text-blue-700 dark:text-blue-300 flex-1">
                                                        <File className="w-4 h-4" />
                                                        <span className="truncate max-w-[200px]">{filename}</span>
                                                    </div>
                                                    <Button
                                                        variant="default"
                                                        onClick={captureFrame}
                                                        className="shadow-md"
                                                        disabled={createReport.isPending}
                                                    >
                                                        <Camera className="w-4 h-4 mr-2" />
                                                        Capture Frame
                                                    </Button>
                                                </div>
                                                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                                                    <p className="text-sm text-amber-800 dark:text-amber-200">
                                                        <strong>Step 1:</strong> Pause the video at the frame where the license plate is most visible, then click "Capture Frame".
                                                    </p>
                                                </div>
                                            </>
                                        ) : showCropTool ? (
                                            <>
                                                <div className="relative rounded-xl overflow-hidden border-2 border-primary bg-card shadow-lg">
                                                    <ReactCrop
                                                        crop={crop}
                                                        onChange={(c) => setCrop(c)}
                                                        onComplete={handleCropComplete}
                                                        aspect={undefined}
                                                    >
                                                        <img
                                                            ref={imageRef}
                                                            src={capturedFrame}
                                                            alt="Captured frame"
                                                            className="w-full h-auto max-h-96 object-contain bg-black"
                                                        />
                                                    </ReactCrop>
                                                    <div className="absolute top-2 right-2">
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            className="rounded-full shadow-lg"
                                                            onClick={clearSelection}
                                                            disabled={createReport.isPending}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                                    <p className="text-sm text-blue-800 dark:text-blue-200">
                                                        <strong>Step 2:</strong> Drag the selection box around the license plate area. Resize using the corner handles.
                                                    </p>
                                                </div>
                                                <div className="flex gap-3">
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => setCapturedFrame(null)}
                                                        className="flex-1"
                                                        disabled={createReport.isPending}
                                                    >
                                                        <RotateCcw className="w-4 h-4 mr-2" />
                                                        Recapture Frame
                                                    </Button>
                                                    <Button
                                                        variant="default"
                                                        onClick={cropSelectedRegion}
                                                        className="flex-1"
                                                        disabled={createReport.isPending || !completedCrop}
                                                    >
                                                        <Crop className="w-4 h-4 mr-2" />
                                                        Crop Selection
                                                    </Button>
                                                </div>
                                            </>
                                        ) : croppedImage ? (
                                            <>
                                                <div className="relative rounded-xl overflow-hidden border-2 border-green-500 bg-black/95 shadow-lg flex items-center justify-center min-h-[350px]">
                                                    <img
                                                        src={croppedImage}
                                                        alt="Cropped region"
                                                        className="w-full h-full max-h-[60vh] object-contain"
                                                    />
                                                    <div className="absolute top-2 right-2">
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            className="rounded-full shadow-lg"
                                                            onClick={clearSelection}
                                                            disabled={createReport.isPending}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                    <div className="absolute bottom-2 left-2 bg-green-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg flex items-center gap-1">
                                                        <Crop className="w-3 h-3" />
                                                        Region Selected
                                                    </div>
                                                </div>
                                                <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-3">
                                                    <p className="text-sm text-green-800 dark:text-green-200">
                                                        <strong>Step 3:</strong> Selected region is ready for analysis. Click "Analyze Selected Region" below.
                                                    </p>
                                                </div>
                                                <div className="flex gap-3">
                                                    <Button
                                                        variant="outline"
                                                        onClick={resetCrop}
                                                        className="flex-1"
                                                        disabled={createReport.isPending}
                                                    >
                                                        <RotateCcw className="w-4 h-4 mr-2" />
                                                        Reselect Region
                                                    </Button>
                                                </div>
                                            </>
                                        ) : null}
                                    </div>
                                ) : (
                                    <div
                                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                        onDragLeave={() => setIsDragging(false)}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                        className={cn(
                                            "relative border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer bg-muted/20 hover:bg-muted/40",
                                            isDragging ? "border-primary bg-primary/5 scale-[0.99]" : "border-border"
                                        )}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="video/*"
                                            onChange={handleChange}
                                            className="hidden"
                                            disabled={createReport.isPending}
                                        />
                                        <div className="bg-primary/10 p-4 rounded-full mb-4">
                                            <UploadCloud className="w-8 h-8 text-primary" />
                                        </div>
                                        <h3 className="text-lg font-semibold mb-1">Upload Video File</h3>
                                        <p className="text-sm text-muted-foreground text-center max-w-xs mb-4">
                                            Drag and drop a video here, or click to select a file.
                                        </p>
                                        <Button variant="outline">
                                            Select Video File
                                        </Button>
                                    </div>
                                )}

                                <div className="mt-6 flex justify-end">
                                    <Button
                                        size="lg"
                                        disabled={!video || createReport.isPending || (!croppedImage && !capturedFrame)}
                                        onClick={handleAnalyze}
                                        className="w-full md:w-auto shadow-lg shadow-primary/25"
                                    >
                                        {createReport.isPending ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Analyzing...
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-4 h-4 mr-2" />
                                                {croppedImage ? "Analyze Selected Region" : capturedFrame ? "Analyze Full Frame" : "Start Analysis"}
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
                                    How It Works
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <span className="font-bold text-primary text-sm">1</span>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-sm">Capture Frame</h4>
                                        <p className="text-xs text-muted-foreground mt-1">Pause video at the clearest moment and capture that frame.</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <span className="font-bold text-primary text-sm">2</span>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-sm">Select Region</h4>
                                        <p className="text-xs text-muted-foreground mt-1">Drag a box around the license plate area for focused analysis.</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <span className="font-bold text-primary text-sm">3</span>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-sm">AI Analysis</h4>
                                        <p className="text-xs text-muted-foreground mt-1">Get detailed forensic analysis of the selected region.</p>
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
