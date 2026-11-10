"use client";

import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { MemoryReceipt } from "@/lib/api-types";

const shortBlob = (blobId: string) => `${blobId.slice(0, 6)}…${blobId.slice(-4)}`;

// A blob id as a badge. Click it to read the memory's receipt: the Walrus Blob and its Sui object,
// read live through Tatum. Escape or a click outside closes it without closing the drawer behind it.
export function BlobReceiptPopover({ blobId }: { blobId: string }) {
  const [open, setOpen] = useState(false);
  const [receipt, setReceipt] = useState<MemoryReceipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const toggle = async () => {
    if (open) return setOpen(false);
    setOpen(true);
    if (receipt || loading) return;
    setLoading(true);
    setError(null);
    try {
      setReceipt(await api.receipt(blobId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the receipt.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    // Capture phase, and stopPropagation, so Escape closes this panel and not the drawer that holds it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-block align-middle">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="rounded-sm border border-line px-1.5 py-0.5 font-mono text-[12px] text-mem focus-visible:outline-focus"
      >
        Blob {shortBlob(blobId)}
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Memory receipt"
          className="absolute left-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-2 rounded-md border border-line bg-raised p-3 text-left text-sm text-fg-2 shadow-lg"
        >
          {loading && <p className="text-fg-3">Reading Sui through Tatum…</p>}
          {error && <p role="alert" className="text-bad">{error}</p>}
          {receipt && <ReceiptRows receipt={receipt} />}
        </div>
      )}
    </span>
  );
}

function ReceiptRows({ receipt }: { receipt: MemoryReceipt }) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-fg-3">Memory receipt</p>
      <dl className="space-y-1.5">
        <Row label="Blob ID" value={receipt.blobId} mono />
        {receipt.blobObjectId && <Row label="Sui object" value={receipt.blobObjectId} mono />}
        {receipt.namespaceOnChain && <Row label="Namespace" value={receipt.namespaceOnChain} mono />}
        {receipt.storedAt && <Row label="Stored" value={new Date(receipt.storedAt).toLocaleString()} />}
        {receipt.endEpoch !== null && <Row label="Walrus storage ends at epoch" value={String(receipt.endEpoch)} mono />}
        {receipt.size !== null && <Row label="Size" value={`${receipt.size} bytes`} mono />}
        {receipt.checkpoint && <Row label="Checkpoint" value={receipt.checkpoint} mono />}
      </dl>
      <div className="flex gap-3 pt-1 text-sm">
        <a className="text-mem underline-offset-2 hover:underline" href={receipt.links.walruscan} target="_blank" rel="noopener noreferrer">
          Walrus Explorer ↗
        </a>
        {receipt.links.suiscan && (
          <a className="text-mem underline-offset-2 hover:underline" href={receipt.links.suiscan} target="_blank" rel="noopener noreferrer">
            Suiscan ↗
          </a>
        )}
      </div>
    </>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-fg-3">{label}</dt>
      <dd className={`break-all text-fg ${mono ? "font-mono text-[12px]" : ""}`}>{value}</dd>
    </div>
  );
}
