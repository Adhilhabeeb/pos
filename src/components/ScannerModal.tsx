import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, RefreshCw, AlertTriangle, Sparkles } from 'lucide-react';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

export default function ScannerModal({ isOpen, onClose, onScanSuccess }: ScannerModalProps) {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const qrCodeInstanceRef = useRef<Html5Qrcode | null>(null);
  const elementId = "fullscreen-qr-reader";

  useEffect(() => {
    if (!isOpen) return;

    // Clear previous scanners and states
    setError('');
    setIsScanning(false);

    // Give the DOM a moment to render the element before mounting html5qrcode
    const timer = setTimeout(() => {
      Html5Qrcode.getCameras()
        .then((devices) => {
          if (devices && devices.length > 0) {
            setCameras(devices);
            // Default to back camera if found, otherwise first camera
            const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
            const selectedId = backCam ? backCam.id : devices[0].id;
            setSelectedCameraId(selectedId);
            startScanning(selectedId);
          } else {
            setError("No cameras found on your device.");
          }
        })
        .catch((err) => {
          console.error("Camera detection error", err);
          setError("Failed to access camera. Please check permissions.");
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      stopScanning();
    };
  }, [isOpen]);

  const startScanning = async (deviceId: string) => {
    try {
      if (qrCodeInstanceRef.current) {
        await stopScanning();
      }

      setError('');
      const html5QrCode = new Html5Qrcode(elementId);
      qrCodeInstanceRef.current = html5QrCode;

      await html5QrCode.start(
        deviceId,
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.7;
            return { width: size, height: size };
          }
        },
        (decodedText) => {
          // Success callback
          onScanSuccess(decodedText);
          // Play standard barcode beep if desired or provide visual toast
          if (navigator.vibrate) navigator.vibrate(100);
          stopScanning();
          onClose();
        },
        (errorMessage) => {
          // Verbose logging is ignored during standard operations
        }
      );

      setIsScanning(true);
    } catch (err: any) {
      console.error("Scanner starting error", err);
      setError("Unable to stream camera feed: " + (err.message || err));
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    if (qrCodeInstanceRef.current) {
      try {
        if (qrCodeInstanceRef.current.isScanning) {
          await qrCodeInstanceRef.current.stop();
        }
      } catch (err) {
        console.error("Error stopping scanner", err);
      } finally {
        qrCodeInstanceRef.current = null;
        setIsScanning(false);
      }
    }
  };

  const switchCamera = (deviceId: string) => {
    setSelectedCameraId(deviceId);
    startScanning(deviceId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950/90 backdrop-blur-md p-4 transition-opacity duration-300">
      {/* Container Card */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/90 shadow-2xl">
        
        {/* Header Block */}
        <div className="flex items-center justify-between border-b border-gray-800 bg-gray-950/60 p-4 px-6">
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 text-green-400">
              <Camera className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              </span>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-gray-100">AI Intelligent Scanner</h3>
              <p className="text-xs text-gray-500">Place product barcode or QR inside grid</p>
            </div>
          </div>
          
          <button 
            onClick={() => {
              stopScanning().then(onClose);
            }}
            className="rounded-lg bg-gray-800/80 p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scanner view area */}
        <div className="relative flex flex-col items-center justify-center bg-black p-6">
          
          {/* Main frame container */}
          <div className={`relative h-[320px] w-full overflow-hidden rounded-xl bg-gray-950 flex items-center justify-center border-2 ${isScanning ? 'scanner-running-border border-green-500/85' : 'border-gray-800'}`}>
            <div id={elementId} className="absolute inset-0 w-full h-full object-cover"></div>
            
            {/* Overlay Guides */}
            {isScanning && (
              <>
                {/* Rolling Laser strip */}
                <div className="scanner-laser absolute left-0 right-0 h-0.5 bg-green-400 shadow-[0_0_12px_rgba(74,222,128,0.8)] z-10 pointer-events-none"></div>
                
                {/* Crop corners styled in modern HUD format */}
                <div className="absolute top-4 left-4 h-6 w-6 border-t-3 border-l-3 border-green-400 z-10 rounded-tl-sm"></div>
                <div className="absolute top-4 right-4 h-6 w-6 border-t-3 border-r-3 border-green-400 z-10 rounded-tr-sm"></div>
                <div className="absolute bottom-4 left-4 h-6 w-6 border-b-3 border-l-3 border-green-400 z-10 rounded-bl-sm"></div>
                <div className="absolute bottom-4 right-4 h-6 w-6 border-b-3 border-r-3 border-green-400 z-10 rounded-br-sm"></div>
              </>
            )}

            {!isScanning && !error && (
              <div className="z-10 flex flex-col items-center gap-3 text-center text-gray-500 p-4">
                <RefreshCw className="h-8 w-8 animate-spin text-green-500" />
                <span className="font-mono text-xs uppercase tracking-wide">Starting camera feeds...</span>
              </div>
            )}

            {error && (
              <div className="z-10 flex flex-col items-center text-center text-red-400 p-6">
                <AlertTriangle className="h-10 w-10 text-red-500 mb-3 animate-pulse" />
                <p className="text-sm font-medium">{error}</p>
                <button 
                  onClick={() => selectedCameraId && startScanning(selectedCameraId)}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-red-950/80 px-4 py-2 text-xs font-semibold text-red-300 border border-red-900 transition-colors hover:bg-red-900/60"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retry Access
                </button>
              </div>
            )}
          </div>

          {/* Scanner Controls / Camera Selection */}
          {cameras.length > 1 && (
            <div className="mt-4 w-full flex items-center gap-2">
              <label className="text-xs font-mono text-gray-400 shrink-0">Camera:</label>
              <select
                value={selectedCameraId}
                onChange={(e) => switchCamera(e.target.value)}
                className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs text-gray-300 shadow-sm focus:border-green-500 focus:outline-none"
              >
                {cameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label || `Camera ${cam.id.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Scanning status banner */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${isScanning ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></span>
            <span className="font-mono text-xs uppercase tracking-wider text-gray-400">
              {isScanning ? 'Scanner status: active' : 'Scanner status: initializing'}
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}
