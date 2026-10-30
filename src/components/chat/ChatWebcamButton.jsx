import { useState, useRef, useEffect } from "react";
import { Camera, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isMobileApp } from "@/lib/platform";

// Opens the webcam in a dialog and hands the captured picture back as a File.
// Used on desktop browsers and inside the native mobile app WebView, where the
// <input capture> attribute is ignored.
export default function ChatWebcamButton({ disabled, onCapture }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const [facingFront, setFacingFront] = useState(false);
  const streamRef = useRef(null);
  const videoRef = useRef(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => stopStream, []);

  const openCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      const msg = "Camera is not available in this browser. Please use a file upload instead.";
      setError(msg);
      toast.error(msg);
      return;
    }
    try {
      // Prefer the back camera on mobile, front camera on desktop.
      const facingMode = isMobileApp() ? { ideal: "environment" } : "user";
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
      });
      setOpen(true);
    } catch (e) {
      let msg = "Could not access the camera. Please allow camera permission in your browser.";
      if (e?.name === "NotAllowedError") {
        msg = "Camera permission was denied. Please allow camera access in your browser settings.";
      } else if (e?.name === "NotFoundError") {
        msg = "No camera found on this device.";
      }
      setError(msg);
      toast.error(msg);
    }
  };

  const close = () => {
    stopStream();
    setOpen(false);
    setError(null);
  };

  const flipCamera = async () => {
    setFacingFront((prev) => {
      const next = !prev;
      // Restart the stream with the new facing mode.
      stopStream();
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: next ? "user" : { ideal: "environment" } } })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        })
        .catch(() => {
          // If the other camera isn't available, ignore silently.
        });
      return next;
    });
  };

  const attachStream = async (el) => {
    videoRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      try {
        await el.play();
      } catch {
        // Autoplay might be blocked; the muted attribute should prevent this.
      }
    }
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
          <video
            ref={attachStream}
            autoPlay
            playsInline
            muted
            className="w-full rounded-lg bg-black"
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close}>Cancel</Button>
            {isMobileApp() && (
              <Button variant="outline" onClick={flipCamera} disabled={!!error}>
                <RefreshCw className="h-4 w-4" /> Flip
              </Button>
            )}
            <Button onClick={capture} disabled={!!error}>
              <Camera className="h-4 w-4" /> Capture
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}