import { FileText, Image, FileSpreadsheet, File, Download, ExternalLink } from 'lucide-react';
import type { DocFileEntry } from '../lib/clientDocsApi';
import { formatFileSize } from '../lib/clientDocsApi';

const TYPE_COLORS: Record<string, string> = {
  PDF: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  Image: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  DOC: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  XLSX: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  Autre: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

function FileIcon({ type, mime }: { type: string; mime: string }) {
  const cls = 'w-8 h-8';
  if (type === 'Image') return <Image className={cls} />;
  if (type === 'PDF') return <FileText className={cls} />;
  if (type === 'XLSX') return <FileSpreadsheet className={cls} />;
  if (type === 'DOC') return <FileText className={cls} />;
  return <File className={cls} />;
}

interface Props {
  file: DocFileEntry;
  onClick: () => void;
}

export function DocFileCard({ file, onClick }: Props) {
  const colorCls = TYPE_COLORS[file.type] ?? TYPE_COLORS['Autre'];
  const isImage = file.type === 'Image';

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all text-left w-full"
    >
      <div className="h-28 flex items-center justify-center bg-gray-50 dark:bg-gray-750 overflow-hidden">
        {isImage ? (
          <img
            src={file.url}
            alt={file.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${colorCls}`}>
            <FileIcon type={file.type} mime={file.mime} />
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-1.5">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate leading-tight" title={file.name}>
          {file.name}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${colorCls}`}>
            {file.type}
          </span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0">
            {formatFileSize(file.size)}
          </span>
        </div>
      </div>

      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={file.downloadUrl}
          onClick={(e) => e.stopPropagation()}
          className="w-7 h-7 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:hover:text-gray-100 shadow-sm"
          title="Télécharger"
        >
          <Download size={13} />
        </a>
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="w-7 h-7 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:hover:text-gray-100 shadow-sm"
          title="Ouvrir"
        >
          <ExternalLink size={13} />
        </a>
      </div>
    </button>
  );
}
