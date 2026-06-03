"use client";

import { Html5Qrcode } from "html5-qrcode";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import ScanSuccessModal, { type ScanSuccessDetails } from "@/components/ScanSuccessModal";

const TOKEN_DEBOUNCE_MS = 3000;

type CheckinResponse = {
  checkedIn?: boolean;
  checkedInAt?: string;
  delegateName?: string;
  alreadyUsed?: boolean;
  error?: string;
};

export default function QrScannerPanel() {
  const reactId = useId();
  const elementId = `qr-reader-${reactId.replace(/[:]/g, "")}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const blockScanRef = useRef(false);
  const lastAttemptRef = useRef<{ token: string; at: number } | null>(null);

  const [running, setRunning] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [error, setError] = useState("");
  const [rawToken, setRawToken] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);
  const [successDetails, setSuccessDetails] = useState<ScanSuccessDetails | null>(null);

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        void scannerRef.current.stop();
      }
      void scannerRef.current?.clear();
    };
  }, []);

  const shouldSkipToken = useCallback((qrToken: string) => {
    const trimmed = qrToken.trim();
    if (!trimmed) return true;
    const last = lastAttemptRef.current;
    if (last && last.token === trimmed && Date.now() - last.at < TOKEN_DEBOUNCE_MS) {
      return true;
    }
    return false;
  }, []);

  const markTokenAttempt = useCallback((qrToken: string) => {
    lastAttemptRef.current = { token: qrToken.trim(), at: Date.now() };
  }, []);

  const handleAlreadyUsed = useCallback((detail?: string, checkedInAt?: string | null) => {
    const base =
      detail || "This pass was already used for check-in and cannot be scanned again.";
    setError(
      checkedInAt ? `${base} (${new Date(checkedInAt).toLocaleString()})` : base
    );
  }, []);

  const closeSuccessModal = useCallback(() => {
    setSuccessOpen(false);
    setSuccessDetails(null);
    setError("");
    blockScanRef.current = false;
  }, []);

  useEffect(() => {
    blockScanRef.current = successOpen || isCheckingIn;
  }, [successOpen, isCheckingIn]);

  const performCheckin = useCallback(
    async (qrToken: string) => {
      const trimmed = qrToken.trim();
      if (!trimmed || processingRef.current || shouldSkipToken(trimmed)) return;

      processingRef.current = true;
      setIsCheckingIn(true);
      setError("");
      markTokenAttempt(trimmed);
      setRawToken(trimmed);

      try {
        const response = await fetch("/api/checkins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ qrToken: trimmed, deviceMeta: "webcam-scanner" }),
        });
        const data = (await response.json()) as CheckinResponse;

        if (response.status === 409 && data.alreadyUsed) {
          handleAlreadyUsed(data.error, data.checkedInAt);
          return;
        }

        if (!response.ok) {
          setError(data.error || "Check-in failed.");
          return;
        }

        if (!data.checkedInAt || !data.delegateName) {
          setError("Check-in succeeded but response was incomplete.");
          return;
        }

        blockScanRef.current = true;
        setSuccessDetails({
          delegateName: data.delegateName,
          checkedInAt: data.checkedInAt,
        });
        setSuccessOpen(true);
      } catch {
        setError("Could not reach server. Check your connection and try again.");
      } finally {
        processingRef.current = false;
        setIsCheckingIn(false);
      }
    },
    [handleAlreadyUsed, markTokenAttempt, shouldSkipToken]
  );

  const startScanner = async () => {
    setError("");
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(elementId);
    }
    try {
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          if (blockScanRef.current || processingRef.current) return;
          void performCheckin(decodedText);
        },
        () => {}
      );
      setRunning(true);
    } catch {
      setError("Unable to access camera. Check browser permissions.");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
    }
    setRunning(false);
  };

  return (
    <>
      <div className="card p-6 rounded-2xl">
        <h3 className="text-lg font-bold mb-3" style={{ color: "var(--fg)" }}>
          Camera Check-in Scanner
        </h3>
        <div className="flex gap-2 mb-3 flex-wrap">
          {!running ? (
            <button className="btn btn-primary text-xs" onClick={() => void startScanner()}>
              Start Camera
            </button>
          ) : (
            <button className="btn btn-ghost text-xs" onClick={() => void stopScanner()}>
              Stop Camera
            </button>
          )}
          <button
            className="btn btn-outline-blue text-xs"
            onClick={() => void performCheckin(rawToken)}
            disabled={!rawToken || isCheckingIn}
          >
            Check in pasted token
          </button>
        </div>

        {isCheckingIn && (
          <p className="text-xs mb-3" style={{ color: "var(--fg-muted)" }}>
            Checking in…
          </p>
        )}

        <div id={elementId} className="rounded-xl overflow-hidden" />

        <div className="mt-3 space-y-2">
          <input
            className="input-base text-xs"
            placeholder="Paste QR token manually"
            value={rawToken}
            onChange={(event) => setRawToken(event.target.value)}
          />
          <button
            className="btn btn-primary text-xs"
            onClick={() => void performCheckin(rawToken)}
            disabled={!rawToken || isCheckingIn}
          >
            Check in
          </button>
        </div>

        {error && (
          <p className="text-xs mt-3" style={{ color: "#dc2626" }}>
            {error}
          </p>
        )}
      </div>

      <ScanSuccessModal open={successOpen} details={successDetails} onClose={closeSuccessModal} />
    </>
  );
}
