"use client";

import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useId, useRef, useState } from "react";

type VerifiedPayload = {
  valid?: boolean;
  passId: string;
  registrationId: string;
  eventId: string;
  delegateName: string;
  delegateEmail: string;
  eventName: string;
  committeeName?: string;
  portfolioName?: string;
  categoryName: string;
  checkedIn: boolean;
  checkedInAt?: string | null;
};

export default function QrScannerPanel() {
  const reactId = useId();
  const elementId = `qr-reader-${reactId.replace(/[:]/g, "")}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [rawToken, setRawToken] = useState("");
  const [verified, setVerified] = useState<VerifiedPayload | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        void scannerRef.current.stop();
      }
      void scannerRef.current?.clear();
    };
  }, []);

  const verifyToken = async (qrToken: string) => {
    setError("");
    setMessage("");
    const response = await fetch("/api/passes/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ qrToken }),
    });
    const data = await response.json();
    if (!response.ok) {
      setVerified(null);
      setError(data.error || "Verification failed.");
      return;
    }
    setVerified(data as VerifiedPayload);
  };

  const handleCheckin = async () => {
    if (!rawToken) return;
    const response = await fetch("/api/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ qrToken: rawToken, deviceMeta: "webcam-scanner" }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Check-in failed.");
      return;
    }
    if (data.duplicate) {
      setMessage(`Already checked in at ${new Date(data.checkedInAt).toLocaleString()}.`);
    } else {
      setMessage(`Checked in successfully at ${new Date(data.checkedInAt).toLocaleString()}.`);
    }
    await verifyToken(rawToken);
  };

  const startScanner = async () => {
    setError("");
    setMessage("");
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(elementId);
    }
    try {
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          setRawToken(decodedText);
          void verifyToken(decodedText);
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
    <div className="card p-6 rounded-2xl">
      <h3 className="text-lg font-bold mb-3" style={{ color: "var(--fg)" }}>Camera Check-in Scanner</h3>
      <div className="flex gap-2 mb-3">
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
          onClick={() => void verifyToken(rawToken)}
          disabled={!rawToken}
        >
          Re-verify
        </button>
      </div>

      <div id={elementId} className="rounded-xl overflow-hidden" />

      <div className="mt-3 space-y-2">
        <input
          className="input-base text-xs"
          placeholder="Paste QR token manually"
          value={rawToken}
          onChange={(event) => setRawToken(event.target.value)}
        />
        <button className="btn btn-ghost text-xs" onClick={() => void verifyToken(rawToken)} disabled={!rawToken}>
          Verify Pasted Token
        </button>
      </div>

      {error && <p className="text-xs mt-3" style={{ color: "#dc2626" }}>{error}</p>}
      {message && <p className="text-xs mt-3" style={{ color: "var(--blue)" }}>{message}</p>}

      {verified && (
        <div className="mt-4 p-4 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{verified.delegateName}</p>
          <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
            {verified.eventName} · {verified.categoryName}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
            Committee: {verified.committeeName || "N/A"} · Portfolio: {verified.portfolioName || "N/A"}
          </p>
          <p className="text-xs mt-1" style={{ color: verified.checkedIn ? "#d97706" : "#16a34a" }}>
            {verified.checkedIn
              ? `Already checked in${verified.checkedInAt ? ` (${new Date(verified.checkedInAt).toLocaleString()})` : ""}`
              : "Not checked in yet"}
          </p>
          <button
            className="btn btn-primary text-xs mt-3"
            onClick={() => void handleCheckin()}
            disabled={verified.checkedIn}
          >
            Confirm Check-in
          </button>
        </div>
      )}
    </div>
  );
}
