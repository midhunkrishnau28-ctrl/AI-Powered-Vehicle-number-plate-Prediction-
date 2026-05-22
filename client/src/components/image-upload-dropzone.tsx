import { useCallback, useState } from "react";
import { UploadCloud, File, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImageUploadDropzoneProps {
  onImageSelected: (base64: string, filename: string) => void;
  isProcessing: boolean;
}

export function ImageUploadDropzone({ onImageSelected, isProcessing }: ImageUploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("");

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreview(result);
      setFilename(file.name);
      onImageSelected(result, file.name);
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
    setPreview(null);
    setFilename("");
  };

  return (
    <div className="w-full">
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-border bg-card shadow-lg group">
          <img src={preview} alt="Preview" className="w-full h-64 md:h-96 object-contain bg-black/5" />
          <div className="absolute top-2 right-2">
            <Button
              variant="destructive"
              size="icon"
              className="rounded-full shadow-lg"
              onClick={clearSelection}
              disabled={isProcessing}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-background/90 backdrop-blur-sm border-t border-border flex items-center gap-2">
            <File className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium truncate">{filename}</span>
          </div>
          {isProcessing && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] flex flex-col items-center justify-center z-10">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
              <p className="font-semibold text-primary">Processing Image...</p>
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer bg-muted/20 hover:bg-muted/40",
            isDragging ? "border-primary bg-primary/5 scale-[0.99]" : "border-border"
          )}
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
            disabled={isProcessing}
          />
          <div className="bg-primary/10 p-4 rounded-full mb-4">
            <UploadCloud className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Upload Vehicle Image</h3>
          <p className="text-sm text-muted-foreground text-center max-w-xs mb-4">
            Drag and drop an image here, or click to select a file for number plate analysis.
          </p>
          <Button variant="outline" className="pointer-events-none">
            Select File
          </Button>
        </div>
      )}
    </div>
  );
}
