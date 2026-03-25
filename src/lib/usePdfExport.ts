import { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { hourlyApi, incidentApi, imageApi, wifiApi, setupStepApi } from './eventReportApi';
import { PrintableReport } from '../components/PrintableReport';
import type { PrintableReportData, PrintableDayData } from '../components/PrintableReport';
import type { EventReport, EventReportDay } from './eventReportTypes';

type ReportRow = EventReport & { venue_client_name?: string; venue_client_logo?: string | null };

export function usePdfExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = useCallback(async (report: ReportRow, days: EventReportDay[]) => {
    setIsExporting(true);
    try {
      const [wifiNetworks, setupSteps, ...dayDataArrays] = await Promise.all([
        wifiApi.listForReport(report.id),
        setupStepApi.listForReport(report.id),
        ...days.map(async (day): Promise<PrintableDayData> => {
          const [hourlyRows, incidents, images] = await Promise.all([
            hourlyApi.listForDay(day.id),
            incidentApi.listForDay(day.id),
            imageApi.listForDay(day.id),
          ]);
          return { day, hourlyRows, incidents, images };
        }),
      ]);

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

      await new Promise<void>((resolve) => {
        const imgs = printRoot.querySelectorAll('img');
        if (imgs.length === 0) { resolve(); return; }
        let loaded = 0;
        const onLoad = () => { loaded++; if (loaded >= imgs.length) resolve(); };
        imgs.forEach((img) => {
          if (img.complete) { loaded++; }
          else { img.addEventListener('load', onLoad); img.addEventListener('error', onLoad); }
        });
        if (loaded >= imgs.length) resolve();
      });

      await new Promise((r) => setTimeout(r, 200));

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
