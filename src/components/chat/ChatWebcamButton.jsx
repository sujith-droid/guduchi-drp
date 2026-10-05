import { useState, useRef, useEffect } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// "Take photo" for computers: opens the webcam in a dialog and hands the captured
// picture back as a File. (Phones use the native camera via ChatAttachButton.)
export default function ChatWebcamButton({ disabled, onCapture }) {
  const [open, setOpen] = useState(false);
  const streamRef = useRef(null);
  const videoRef = useRef(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => stopStream, []);

  const openCamera = async () => {
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true });
      setOpen(true);
    } catch {
      toast.error("Could not access the camera. Please allow camera permission in your browser.");
    }
  };

  const close = () => {
    stopStream();
    setOpen(false);
  };

  const attachStream = (el) => {
    videoRef.current = el;
    if (el && el.srcObject !== streamRef.current) el.srcObject = streamRef.current;
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      close();
      onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  };

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Take photo" onClick={openCamera} disabled={disabled} className="shrink-0 min-h-[44px] min-w-[44px]">
        <Camera className="h-5 w-5" />
      </Button>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Take a photo</DialogTitle>
          </DialogHeader>
          <video ref={attachStream} autoPlay playsInline muted className="w-full rounded-lg bg-black" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button onClick={capture}>
              <Camera className="h-4 w-4" /> Capture
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}