"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Trash, Play, Stop, ArrowClockwise } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "@/hooks/useTranslation";

interface CapturedRequest {
  id: string;
  method: string;
  url: string;
  requestHeaders?: Record<string, string>;
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  componentTag?: string;
  capturedAt: string;
}

interface TrafficCapturePanelProps {
  width: number;
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
  onClose: () => void;
}

export function TrafficCapturePanel({ width, onResize, onResizeEnd, onClose }: TrafficCapturePanelProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [componentTag, setComponentTag] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [requests, setRequests] = useState<CapturedRequest[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Listen for traffic capture events from main process
  useEffect(() => {
    const handleCapture = (data: CapturedRequest) => {
      setRequests((prev) => [data, ...prev]);
    };

    const handleCaptureUpdate = (data: { id: string; responseStatus?: number; responseHeaders?: Record<string, string> }) => {
      setRequests((prev) =>
        prev.map((req) =>
          req.id === data.id
            ? { ...req, responseStatus: data.responseStatus, responseHeaders: data.responseHeaders }
            : req
        )
      );
    };

    // Check initial capture status
    window.electronAPI?.traffic?.status().then((status: { isCapturing: boolean }) => {
      setIsCapturing(status.isCapturing);
    });

    window.electronAPI?.traffic?.onCapture(handleCapture);
    window.electronAPI?.traffic?.onCaptureUpdate(handleCaptureUpdate);

    return () => {
      window.electronAPI?.traffic?.onCapture(handleCapture);
      window.electronAPI?.traffic?.onCaptureUpdate(handleCaptureUpdate);
    };
  }, []);

  const handleStartCapture = useCallback(async () => {
    if (!url.trim()) return;
    const result = await window.electronAPI?.traffic?.start({ url: url.trim(), componentTag: componentTag.trim() });
    if (result?.success) {
      setIsCapturing(true);
      setRequests([]);
      setSelectedIds(new Set());
    }
  }, [url, componentTag]);

  const handleStopCapture = useCallback(async () => {
    await window.electronAPI?.traffic?.stop();
    setIsCapturing(false);
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    for (const id of selectedIds) {
      await fetch(`/api/traffic-capture?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    }
    setRequests((prev) => prev.filter((r) => !selectedIds.has(r.id)));
    setSelectedIds(new Set());
  }, [selectedIds]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const filteredRequests = requests.filter((req) => {
    if (!componentTag.trim()) return true;
    return req.url.includes(componentTag.trim()) || req.url.includes(req.componentTag || "");
  });

  return (
    <aside className="flex h-full shrink-0 flex-col" style={{ width }}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
        <span className="text-xs font-medium">{t('trafficCapture.title')}</span>
        <div className="ml-auto flex items-center gap-1">
          {selectedIds.size > 0 && (
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={handleDeleteSelected}>
              <Trash className="h-3 w-3 mr-1" />
              {t('trafficCapture.deleteSelected', { count: selectedIds.size })}
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* URL and Tag inputs */}
      <div className="flex flex-col gap-2 border-b border-border/40 px-3 py-2">
        <div className="flex gap-2">
          <Input
            placeholder={t('trafficCapture.urlPlaceholder')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-7 text-xs"
            disabled={isCapturing}
          />
          {isCapturing ? (
            <Button variant="destructive" size="sm" className="h-7 px-2" onClick={handleStopCapture}>
              <Stop className="h-3 w-3 mr-1" />
              {t('trafficCapture.stop')}
            </Button>
          ) : (
            <Button variant="default" size="sm" className="h-7 px-2" onClick={handleStartCapture} disabled={!url.trim()}>
              <Play className="h-3 w-3 mr-1" />
              {t('trafficCapture.start')}
            </Button>
          )}
        </div>
        <Input
          placeholder={t('trafficCapture.componentTagPlaceholder')}
          value={componentTag}
          onChange={(e) => setComponentTag(e.target.value)}
          className="h-7 text-xs"
        />
      </div>

      {/* Request list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-0.5 p-2">
          {filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <ArrowClockwise className="h-6 w-6 mb-2 opacity-50" />
              <p className="text-xs">{isCapturing ? t('trafficCapture.waiting') : t('trafficCapture.empty')}</p>
            </div>
          ) : (
            filteredRequests.map((req) => (
              <div
                key={req.id}
                className={`group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50 ${
                  selectedIds.has(req.id) ? "bg-muted" : ""
                }`}
                onClick={() => handleToggleSelect(req.id)}
              >
                {/* Method badge */}
                <span
                  className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-medium ${
                    req.method === "GET"
                      ? "bg-green-500/20 text-green-600"
                      : req.method === "POST"
                      ? "bg-blue-500/20 text-blue-600"
                      : req.method === "PUT"
                      ? "bg-yellow-500/20 text-yellow-600"
                      : req.method === "DELETE"
                      ? "bg-red-500/20 text-red-600"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {req.method}
                </span>

                {/* Status badge */}
                {req.responseStatus && (
                  <span
                    className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-medium ${
                      req.responseStatus < 300
                        ? "bg-green-500/20 text-green-600"
                        : req.responseStatus < 400
                        ? "bg-yellow-500/20 text-yellow-600"
                        : "bg-red-500/20 text-red-600"
                    }`}
                  >
                    {req.responseStatus}
                  </span>
                )}

                {/* URL */}
                <span className="min-w-0 flex-1 truncate text-xs text-foreground/80">
                  {req.url.replace(/^https?:\/\//, "").split("?")[0]}
                </span>

                {/* Delete button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    fetch(`/api/traffic-capture?id=${encodeURIComponent(req.id)}`, { method: "DELETE" });
                    setRequests((prev) => prev.filter((r) => r.id !== req.id));
                  }}
                >
                  <Trash className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Resize handle (right side) */}
      <div
        onPointerDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startWidth = width;

          const handleMove = (moveEvent: PointerEvent) => {
            const delta = moveEvent.clientX - startX;
            onResize(delta);
          };

          const handleUp = () => {
            document.removeEventListener("pointermove", handleMove);
            document.removeEventListener("pointerup", handleUp);
            onResizeEnd?.();
          };

          document.addEventListener("pointermove", handleMove);
          document.addEventListener("pointerup", handleUp);
        }}
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize group-hover:bg-border"
      />
    </aside>
  );
}
