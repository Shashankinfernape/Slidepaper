import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const DownloadContext = createContext();

export function DownloadProvider({ children }) {
  const [downloads, setDownloads] = useState([]);
  const [isMinimized, setIsMinimized] = useState(false);
  
  const activeControllersRef = useRef({}); // id -> { abortController, xhr, prepTimer }
  const isProcessingQueueRef = useRef(false);

  const updateDownloadMetrics = useCallback((id, updates) => {
    setDownloads((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const newMetrics = typeof updates === 'function' ? updates(item.metrics) : { ...item.metrics, ...updates };
        return { ...item, metrics: newMetrics };
      })
    );
  }, []);

  const updateDownloadStatus = useCallback((id, status) => {
    setDownloads((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );
  }, []);

  const removeDownload = useCallback((id) => {
    if (activeControllersRef.current[id]) {
      const { prepTimer, xhr, abortController } = activeControllersRef.current[id];
      if (prepTimer) clearInterval(prepTimer);
      if (xhr) try { xhr.abort(); } catch (_) {}
      if (abortController) try { abortController.abort(); } catch (_) {}
      delete activeControllersRef.current[id];
    }
    setDownloads((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const cancelDownload = useCallback((id) => {
    removeDownload(id);
  }, [removeDownload]);

  const executeDownloadTask = useCallback(async (item) => {
    const { id: downloadId, bundle, wStr, hStr, ratioTag, predictedTotalMB, predictedZipBytes } = item;
    const totalImgs = bundle.images?.length || 1;

    updateDownloadStatus(downloadId, 'downloading');
    updateDownloadMetrics(downloadId, {
      stage: `Cropping wallpaper 1/${totalImgs} (0.0s)...`,
      steps: [
        { label: `Cropping 1/${totalImgs} wallpapers`, status: 'active', duration: '0.0s' },
        { label: 'GCS upload & sign URL', status: 'pending', duration: '' },
        { label: 'Download pack ZIP', status: 'pending', duration: '' }
      ]
    });

    const abortController = new AbortController();
    activeControllersRef.current[downloadId] = { abortController };

    const stepStart = Date.now();

    const prepTimer = setInterval(() => {
      const elapsedMs = Date.now() - stepStart;
      const elapsedSec = (elapsedMs / 1000).toFixed(1);
      const currImg = Math.min(totalImgs, Math.max(1, Math.floor((elapsedMs / 1000) / 1.4) + 1));
      const prepProgress = Math.min(40, Math.max(5, Math.floor((currImg / totalImgs) * 38)));

      updateDownloadMetrics(downloadId, (prev) => {
        if (!prev || prev.stage.includes('Downloading') || prev.stage.includes('Complete')) return prev;
        return {
          ...prev,
          progress: prepProgress,
          stage: `Cropping wallpaper ${currImg}/${totalImgs} (${elapsedSec}s)...`,
          steps: [
            { label: `Cropping wallpaper ${currImg}/${totalImgs}`, status: 'active', duration: `${elapsedSec}s` },
            { label: 'GCS upload & sign URL', status: 'pending', duration: '' },
            { label: 'Download pack ZIP', status: 'pending', duration: '' }
          ]
        };
      });
    }, 200);

    if (activeControllersRef.current[downloadId]) {
      activeControllersRef.current[downloadId].prepTimer = prepTimer;
    }

    try {
      const response = await fetch(`${API_URL}/api/custom-ratio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundleId: bundle.id,
          widthRatio: wStr,
          heightRatio: hStr,
        }),
        signal: abortController.signal
      });

      clearInterval(prepTimer);
      const prepSec = ((Date.now() - stepStart) / 1000).toFixed(1);

      if (!response.ok) {
        let errorMessage = 'Failed to process wallpaper bundle';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (_) {}
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (bundle.stats && data.downloads !== undefined) {
          bundle.stats.downloads = data.downloads;
        }

        if (!data || !data.downloadUrl) {
          throw new Error('Server returned an invalid download URL');
        }

        const downloadUrl = data.downloadUrl.startsWith('http')
          ? data.downloadUrl
          : `${API_URL}${data.downloadUrl}`;

        const zipSizeBytes = data.zipSizeBytes || 0;
        const knownTotalMB = zipSizeBytes > 0 ? zipSizeBytes / (1024 * 1024) : predictedTotalMB;

        updateDownloadMetrics(downloadId, (prev) => ({
          ...prev,
          progress: 42,
          stage: 'Downloading from GCS CDN...',
          totalMB: knownTotalMB,
          steps: [
            { label: 'Built & uploaded to GCS', status: 'done', duration: `${prepSec}s` },
            { label: 'GCS CDN download', status: 'active', duration: '0.0s' },
          ]
        }));

        const xhrStart = Date.now();
        let lastLoaded = 0;
        let lastTime = xhrStart;

        const xhr = new XMLHttpRequest();
        if (activeControllersRef.current[downloadId]) {
          activeControllersRef.current[downloadId].xhr = xhr;
        }

        xhr.open('GET', downloadUrl, true);
        xhr.responseType = 'blob';

        xhr.onprogress = (e) => {
          const totalBytes = (e.lengthComputable && e.total > 0)
            ? e.total
            : (zipSizeBytes > 0 ? zipSizeBytes : predictedZipBytes);
          const loadedBytes = e.loaded;
          const pct = totalBytes > 0
            ? Math.min(99, Math.floor((loadedBytes / totalBytes) * 100))
            : Math.min(99, Math.floor(loadedBytes / (1024 * 1024)));

          const currentTime = Date.now();
          const timeDelta = (currentTime - lastTime) / 1000;

          if (timeDelta >= 0.15) {
            const bytesDelta = loadedBytes - lastLoaded;
            const speedBps = bytesDelta / timeDelta;
            const speedMbps = (speedBps * 8) / (1024 * 1024);
            const remainingBytes = totalBytes > 0 ? Math.max(0, totalBytes - loadedBytes) : 0;
            const eta = speedBps > 0 && remainingBytes > 0 ? remainingBytes / speedBps : 0;
            const dlSec = ((currentTime - xhrStart) / 1000).toFixed(1);

            updateDownloadMetrics(downloadId, {
              progress: pct,
              speedMbps,
              transferredMB: loadedBytes / (1024 * 1024),
              totalMB: totalBytes / (1024 * 1024),
              etaSeconds: eta,
              stage: 'Downloading from GCS CDN...',
              steps: [
                { label: 'Built & uploaded to GCS', status: 'done', duration: `${prepSec}s` },
                { label: 'GCS CDN download', status: 'active', duration: `${dlSec}s` },
              ]
            });

            lastLoaded = loadedBytes;
            lastTime = currentTime;
          }
        };

        const cleanRatio = ratioTag.replace(/[^a-zA-Z0-9_-]/g, 'x');
        const outFilename = `${bundle.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${cleanRatio}.zip`;

        xhr.onload = () => {
          if (xhr.status === 200) {
            const blob = xhr.response;
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.setAttribute('download', outFilename);
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              try { a.remove(); window.URL.revokeObjectURL(blobUrl); } catch (_) {}
            }, 20000);

            updateDownloadMetrics(downloadId, { progress: 100, stage: 'Complete' });
            updateDownloadStatus(downloadId, 'complete');
            setTimeout(() => removeDownload(downloadId), 4000);
          } else {
            window.location.href = downloadUrl;
            updateDownloadStatus(downloadId, 'complete');
            setTimeout(() => removeDownload(downloadId), 4000);
          }
        };

        xhr.onerror = () => {
          window.location.href = downloadUrl;
          updateDownloadStatus(downloadId, 'complete');
          setTimeout(() => removeDownload(downloadId), 4000);
        };

        xhr.send();
      } else {
        // Direct stream reader fallback
        const cleanRatio = ratioTag.replace(/[^a-zA-Z0-9_-]/g, 'x');
        const outFilename = `${bundle.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${cleanRatio}.zip`;

        const reader = response.body.getReader();
        const contentLength = +(response.headers.get('content-length') || response.headers.get('x-content-length') || 0);
        const chunks = [];
        let receivedBytes = 0;
        const streamStart = Date.now();
        let lastLoaded = 0;
        let lastTime = streamStart;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          receivedBytes += value.length;

          const currentTime = Date.now();
          const timeDelta = (currentTime - lastTime) / 1000;

          if (timeDelta >= 0.15) {
            const bytesDelta = receivedBytes - lastLoaded;
            const speedBps = bytesDelta / timeDelta;
            const speedMbps = (speedBps * 8) / (1024 * 1024);
            const targetBytes = contentLength > 0 ? contentLength : predictedZipBytes;
            const pct = targetBytes > 0
              ? Math.min(99, Math.floor((receivedBytes / targetBytes) * 100))
              : Math.min(99, Math.floor(receivedBytes / (1024 * 1024)));
            const remainingBytes = targetBytes > 0 ? Math.max(0, targetBytes - receivedBytes) : 0;
            const eta = speedBps > 0 && remainingBytes > 0 ? remainingBytes / speedBps : 0;
            const streamSec = ((currentTime - streamStart) / 1000).toFixed(1);

            updateDownloadMetrics(downloadId, {
              progress: pct,
              speedMbps,
              transferredMB: receivedBytes / (1024 * 1024),
              totalMB: targetBytes / (1024 * 1024),
              etaSeconds: eta,
              stage: 'Downloading pack stream...',
              steps: [
                { label: 'Cropped & packaged', status: 'done', duration: `${prepSec}s` },
                { label: 'Downloading payload stream', status: 'active', duration: `${streamSec}s` },
              ]
            });

            lastLoaded = receivedBytes;
            lastTime = currentTime;
          }
        }

        const blob = new Blob(chunks, { type: 'application/zip' });
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.setAttribute('download', outFilename);
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          try { a.remove(); window.URL.revokeObjectURL(blobUrl); } catch (_) {}
        }, 20000);

        updateDownloadMetrics(downloadId, { progress: 100, stage: 'Complete' });
        updateDownloadStatus(downloadId, 'complete');
        setTimeout(() => removeDownload(downloadId), 4000);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        alert(err.message || 'Failed to prepare download. Please try again.');
      }
      removeDownload(downloadId);
    }
  }, [updateDownloadMetrics, updateDownloadStatus, removeDownload]);

  // Sequential Queue Processor Worker Loop
  useEffect(() => {
    const activeDownloading = downloads.find((item) => item.status === 'downloading');
    const nextQueued = downloads.find((item) => item.status === 'queued');

    if (!activeDownloading && nextQueued && !isProcessingQueueRef.current) {
      isProcessingQueueRef.current = true;
      executeDownloadTask(nextQueued).finally(() => {
        isProcessingQueueRef.current = false;
      });
    }
  }, [downloads, executeDownloadTask]);

  const startDownload = useCallback((bundle, selectedDownloadId, customWidth, customHeight, presets) => {
    const downloadId = `${bundle.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    let ratioTag = '16:9';
    let wStr = '16', hStr = '9';
    if (selectedDownloadId === 'original') {
      ratioTag = 'Original';
      wStr = 'original';
      hStr = 'original';
    } else if (selectedDownloadId === 'custom') {
      wStr = customWidth || '16';
      hStr = customHeight || '9';
      ratioTag = `${wStr}:${hStr}`;
    } else {
      const matched = presets?.find((p) => p.id === selectedDownloadId);
      if (matched) {
        ratioTag = matched.label.split(' ')[0];
        [wStr, hStr] = ratioTag.split(':');
      }
    }

    const sumBytes = bundle.images.reduce((sum, img) => sum + (img.size || 1500000), 0);
    let factor = 1.0;
    if (selectedDownloadId !== 'original') {
      const w = parseFloat(wStr) || 16;
      const h = parseFloat(hStr) || 9;
      const targetRatio = w / h;
      let sourceW = 16, sourceH = 9;
      if (bundle.ratio && bundle.ratio.includes(':')) {
        const parts = bundle.ratio.split(':');
        sourceW = parseFloat(parts[0]) || 16;
        sourceH = parseFloat(parts[1]) || 9;
      }
      const sourceRatio = sourceW / sourceH;
      factor = targetRatio > sourceRatio ? sourceRatio / targetRatio : targetRatio / sourceRatio;
      factor = Math.max(0.05, Math.min(1.0, factor));
    }
    const predictedZipBytes = sumBytes * factor * 0.95;
    const predictedTotalMB = predictedZipBytes / (1024 * 1024);

    const newItem = {
      id: downloadId,
      bundle,
      ratioTag,
      wStr,
      hStr,
      predictedZipBytes,
      predictedTotalMB,
      status: 'queued', // Starts as queued! Worker loop picks it up sequentially
      metrics: {
        progress: 0,
        speedMbps: 0,
        transferredMB: 0,
        totalMB: predictedTotalMB,
        etaSeconds: 0,
        stage: 'Queued in line...',
        steps: [
          { label: 'Queued in line...', status: 'pending', duration: '' },
          { label: 'GCS upload & sign URL', status: 'pending', duration: '' },
          { label: 'Download pack ZIP', status: 'pending', duration: '' }
        ]
      }
    };

    setDownloads((prev) => [...prev, newItem]);
    setIsMinimized(false);
  }, []);

  return (
    <DownloadContext.Provider
      value={{
        downloads,
        isMinimized,
        setIsMinimized,
        startDownload,
        cancelDownload,
        removeDownload
      }}
    >
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownload() {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error('useDownload must be used within a DownloadProvider');
  }
  return context;
}
