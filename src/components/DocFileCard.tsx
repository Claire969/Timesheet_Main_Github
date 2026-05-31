import { FileText, Image, FileSpreadsheet, File, Download, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import type { DocFileEntry } from '../lib/clientDocsApi';
import { formatFileSize } from '../lib/clientDocsApi';

const TYPE_COLORS: Record<string, string> = {
  PDF:   'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  Image: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  DOC:   'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  XLSX:  'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  Autre: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

function FileTypeIcon({ type, className }: { type: string; className?: string }) {
  const cls = className ?? 'w-8 h-8';
  if (type === 'Image') return <Image className={cls} />;
  if (type === 'XLSX')  return <FileSpreadsheet className={cls} />;
  if (type === 'PDF' || type === 'DOC') return <FileText className={cls} />;
  return <File className={cls} />;
}

// PDF placeholder: a clean red card that looks deliberate rather than broken
function PdfPlaceholder({ title }: { title: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 px-3">
      <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
        <FileText className="w-5 h-5 text-red-500 dark:text-red-400" />
      </div>
      <p className="text-[10px] font-semibold text-red-400 dark:text-red-500 uppercase tracking-widest">PDF</p>
    </div>
  );
}

interface Props {
  file: DocFileEntry;
  viewMode: 'grid' | 'list';
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function DocFileCard({ file, viewMode, onClick, onEdit, onDelete }: Props) {
  const colorCls = TYPE_COLORS[file.type] ?? TYPE_COLORS['Autre'];
  const isImage = file.type === 'Image';
  const isPdf   = file.type === 'PDF';

  const actionButtons = (
    <div className="flex gap-1">
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className="w-7 h-7 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 shadow-sm transition-colors"
        title="Modifier"
      >
        <Pencil size={12} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="w-7 h-7 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:text-red-600 dark:hover:text-red-400 shadow-sm transition-colors"
        title="Supprimer"
      >
        <Trash2 size={12} />
      </button>
      <a
        href={file.downloadUrl}
        onClick={(e) => e.stopPropagation()}
        className="w-7 h-7 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:hover:text-gray-100 shadow-sm"
        title="Télécharger"
      >
        <Download size={12} />
      </a>
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="w-7 h-7 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:hover:text-gray-100 shadow-sm"
        title="Ouvrir"
      >
        <ExternalLink size={12} />
      </a>
    </div>
  );

  // ── List view ────────────────────────────────────────────────────────────
  if (viewMode === 'list') {
    return (
      <button
        onClick={onClick}
        className="group flex items-center gap-3 w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all text-left"
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorCls}`}>
          <FileTypeIcon type={file.type} className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate leading-tight">
            {file.title}
          </p>
          {file.title !== file.name && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{file.name}</p>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-4">
          <span className={`hidden sm:inline text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${colorCls}`}>
            {file.type}
          </span>
          <span className="hidden md:inline text-[11px] text-gray-400 dark:text-gray-500 w-16 text-right">
            {formatFileSize(file.size)}
          </span>
          <span className="hidden lg:inline text-[11px] text-gray-400 dark:text-gray-500 w-28 text-right">
            {new Date(file.modifiedAt).toLocaleDateString('fr-FR')}
          </span>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            {actionButtons}
          </div>
        </div>
      </button>
    );
  }

  // ── Grid view ────────────────────────────────────────────────────────────
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all text-left w-full"
    >
      <div className="h-28 flex items-center justify-center bg-gray-50 dark:bg-gray-750 overflow-hidden">
        {isImage ? (
          <img
            src={file.url}
            alt={file.title}
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : isPdf ? (
          <PdfPlaceholder title={file.title} />
        ) : (
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${colorCls}`}>
            <FileTypeIcon type={file.type} />
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-1.5">
        <p
          className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate leading-tight"
          title={file.title}
        >
          {file.title}
        </p>
        {file.title !== file.name && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate" title={file.name}>
            {file.name}
          </p>
        )}
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
        {actionButtons}
      </div>
    </button>
  );
}
