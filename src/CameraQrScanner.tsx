import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";

type Props = {
  onDetected: (value: string) => void;
  onClose: () => void;
};

export default function CameraQrScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let controls: IScannerControls | undefined;
    const reader = new BrowserQRCodeReader();

    const start = async () => {
      try {
        const scannerControls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          videoRef.current || undefined,
          (result, _error, scanControls) => {
            if (!active) {
              scanControls.stop();
              return;
            }
            if (!result) return;
            active = false;
            scanControls.stop();
            onDetected(result.getText());
          },
        );
        controls = scannerControls;
        if (!active) controls.stop();
      } catch (reason) {
        if (!active) return;
        const denied = reason instanceof DOMException && reason.name === "NotAllowedError";
        setError(denied ? "Autorisez l’accès à la caméra dans votre navigateur." : "Impossible d’ouvrir la caméra sur cet appareil.");
      }
    };

    void start();
    return () => {
      active = false;
      controls?.stop();
    };
  }, [onDetected]);

  return (
    <div className="camera-scanner" role="dialog" aria-modal="true" aria-label="Scanner le QR de pointage">
      <section className="camera-panel">
        <header>
          <h2>Scanner le QR de pointage</h2>
          <button type="button" onClick={onClose} aria-label="Fermer la caméra">×</button>
        </header>
        {error ? <div className="camera-error">{error}</div> : <div className="camera-frame"><video ref={videoRef} muted playsInline/><div className="camera-target"/></div>}
        <p>Placez le QR affiché au restaurant au centre du cadre.</p>
      </section>
    </div>
  );
}
