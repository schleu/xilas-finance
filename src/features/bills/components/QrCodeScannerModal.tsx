import { Camera, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
  }
}

interface Props {
  onDetected: (url: string) => void;
  onClose: () => void;
}

export function QrCodeScannerModal({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    let rafId = 0;

    const stopCamera = () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        stream = null;
      }
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          "Câmera indisponível neste navegador. Cole o link da NF-e/NFC-e manualmente.",
        );
        return;
      }
      if (!window.BarcodeDetector) {
        setCameraError(
          "Leitura automática de QR Code não suportada neste navegador. Cole o link da NF-e/NFC-e manualmente.",
        );
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (!active) {
          stopCamera();
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const scan = async () => {
          if (!active || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const firstUrl = codes.find((c) => c.rawValue)?.rawValue?.trim();
            if (firstUrl) {
              stopCamera();
              onDetected(firstUrl);
              return;
            }
          } catch {
            // Keep scanning
          }
          if (active) {
            rafId = requestAnimationFrame(() => void scan());
          }
        };
        rafId = requestAnimationFrame(() => void scan());
      } catch {
        if (active) {
          setCameraError(
            "Não foi possível acessar a câmera (verifique a permissão). Você pode colar o link da NF-e manualmente.",
          );
        }
      }
    };

    void start();

    return () => {
      active = false;
      stopCamera();
    };
  }, [onDetected]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Leitor de QR Code da NF-e"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="h-4 w-4" aria-hidden="true" />
              Ler QR Code da NFC-e
            </CardTitle>
            <CardDescription>Aponte a câmera para o QR Code do cupom fiscal.</CardDescription>
          </div>
          <Button type="button" variant="ghost" size="sm" aria-label="Fechar leitor" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {cameraError ? (
            <p role="alert" className="text-sm text-destructive">
              {cameraError}
            </p>
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-video w-full rounded-md bg-black object-cover"
            />
          )}
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
