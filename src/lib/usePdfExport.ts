import { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { hourlyApi, incidentApi, imageApi, wifiApi, setupStepApi } from './eventReportApi';
import { PrintableReport } from '../components/PrintableReport';
import type { PrintableReportData, PrintableDayData } from '../components/PrintableReport';
import type { EventReport, EventReportDay, EventReportImage } from './eventReportTypes';
import { createSignedImageUrl } from './imageStorageApi';

type ReportRow = EventReport & { venue_client_name?: string; venue_client_logo?: string | null };

async function toDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

async function resolveImageUrl(url: string): Promise<string> {
  if (!url) return url;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('blob:')) return toDataUrl(url);

  const signed = await createSignedImageUrl(url, 300);
  const resolveUrl = signed ?? url;
  return toDataUrl(resolveUrl);
}

async function resolveImages(images: EventReportImage[]): Promise<EventReportImage[]> {
  return Promise.all(
    images.map(async (img) => ({
      ...img,
      file_url: await resolveImageUrl(img.file_url),
    }))
  );
}

export function usePdfExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = useCallback(async (report: ReportRow, days: EventReportDay[]) => {
    setIsExporting(true);
    try {
      console.log(`[PDF Export] Report: ${report.id}, Days received: ${days.length}, Day IDs: ${days.map(d => d.id).join(', ')}`);

      const [wifiNetworks, setupSteps, ...dayDataArrays] = await Promise.all([
        wifiApi.listForReport(report.id),
        setupStepApi.listForReport(report.id),
        ...days.map(async (day): Promise<PrintableDayData> => {
          const [hourlyRows, incidents, rawImages] = await Promise.all([
            hourlyApi.listForDay(day.id),
            incidentApi.listForDay(day.id),
            imageApi.listForDay(day.id),
          ]);
          const images = await resolveImages(rawImages);
          return { day, hourlyRows, incidents, images };
        }),
      ]);

      console.log(`[PDF Export] Processed day data: ${dayDataArrays.length} days`);

      const data: PrintableReportData = {
        report,
        days: dayDataArrays as PrintableDayData[],
        wifiNetworks,
        setupSteps,
      };

      const printRoot = document.getElementById('print-root');
      if (!printRoot) throw new Error('print-root element not found');

      printRoot.style.display = 'block';
      const reactRoot = createRoot(printRoot);
      reactRoot.render(createElement(PrintableReport, { data }));

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      await new Promise<void>((resolve) => {
        const imgs = printRoot.querySelectorAll('img');
        if (imgs.length === 0) { resolve(); return; }
        let pending = 0;
        const done = () => { pending--; if (pending <= 0) resolve(); };
        imgs.forEach((img) => {
          if (!img.complete || img.naturalWidth === 0) {
            pending++;
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          }
        });
        if (pending === 0) resolve();
      });

      await new Promise((r) => setTimeout(r, 300));

      window.print();

      await new Promise((r) => setTimeout(r, 500));

      reactRoot.unmount();
      printRoot.style.display = 'none';
      printRoot.innerHTML = '';
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportPdf, isExporting };
}
