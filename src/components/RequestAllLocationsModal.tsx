import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Send,
  Check,
  MessageCircle,
  MapPin,
  RotateCcw,
  Edit3,
  ChevronDown,
  ChevronUp,
  PhoneOff,
  CheckCircle2,
  Shuffle,
} from 'lucide-react';
import { DeliveryItem } from '../types';
import {
  DEFAULT_LOCATION_REQUEST_TEMPLATES,
  advanceLocationRequestCursor,
  buildWhatsAppUrl,
  formatLocationRequestMessage,
  getLocationRequestCursor,
  getLocationRequestTemplates,
  getRotatingLocationTemplate,
  saveLocationRequestTemplates,
} from '../utils/whatsappParser';
import { WhatsAppTemplatesEditor } from './WhatsAppTemplatesEditor';

interface RequestAllLocationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: DeliveryItem[];
  onEditItem: (item: DeliveryItem) => void;
}

const REQUESTED_IDS_STORAGE_KEY = 'ruteo_location_requested_ids';

function loadRequestedIds(): string[] {
  try {
    const raw = localStorage.getItem(REQUESTED_IDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveRequestedIds(ids: string[]): void {
  try {
    localStorage.setItem(REQUESTED_IDS_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage errors
  }
}

export const RequestAllLocationsModal: React.FC<RequestAllLocationsModalProps> = ({
  isOpen,
  onClose,
  items,
  onEditItem,
}) => {
  const [scope, setScope] = useState<'missing' | 'all'>('missing');
  const [requestedIds, setRequestedIds] = useState<string[]>(() => loadRequestedIds());
  const [showTemplateEditor, setShowTemplateEditor] = useState<boolean>(false);
  const [templatesDraft, setTemplatesDraft] = useState<string[]>([...DEFAULT_LOCATION_REQUEST_TEMPLATES]);
  const [rotationCursor, setRotationCursor] = useState<number>(() => getLocationRequestCursor());
  const [templateSaved, setTemplateSaved] = useState<boolean>(false);

  const itemsWithPhone = useMemo(() => {
    return items
      .filter(i => Boolean(buildWhatsAppUrl(i.phone)))
      .sort((a, b) => a.orderIndex - b.orderIndex || a.originalNumber - b.originalNumber);
  }, [items]);

  const missingLocWithPhone = useMemo(() => {
    return itemsWithPhone.filter(
      i => i.hasLocation === false || i.coverageStatus === 'incomplete'
    );
  }, [itemsWithPhone]);

  const itemsWithoutValidPhone = useMemo(() => {
    return items.filter(
      i =>
        (i.hasLocation === false || i.coverageStatus === 'incomplete') &&
        !buildWhatsAppUrl(i.phone)
    );
  }, [items]);

  useEffect(() => {
    if (isOpen) {
      setTemplatesDraft(getLocationRequestTemplates());
      setRotationCursor(getLocationRequestCursor());
      setTemplateSaved(false);
      setShowTemplateEditor(false);
      setScope(missingLocWithPhone.length > 0 ? 'missing' : 'all');
      const validSet = new Set(items.map(i => i.id));
      setRequestedIds(prev => {
        const filtered = prev.filter(id => validSet.has(id));
        saveRequestedIds(filtered);
        return filtered;
      });
    }
  }, [isOpen, missingLocWithPhone.length, items]);

  if (!isOpen) return null;

  const activeTemplates = (() => {
    const cleaned = templatesDraft.map(t => t.trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : [...DEFAULT_LOCATION_REQUEST_TEMPLATES];
  })();

  const activeList = scope === 'missing' ? missingLocWithPhone : itemsWithPhone;
  const requestedSet = new Set(requestedIds);
  const sentCountInScope = activeList.filter(i => requestedSet.has(i.id)).length;
  const nextPendingItem = activeList.find(i => !requestedSet.has(i.id)) || null;

  const markAsRequested = (id: string) => {
    setRequestedIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveRequestedIds(next);
      return next;
    });
    const nextCursor = advanceLocationRequestCursor(activeTemplates.length);
    setRotationCursor(nextCursor);
  };

  const handleResetRequested = () => {
    const scopeIds = new Set(activeList.map(i => i.id));
    setRequestedIds(prev => {
      const next = prev.filter(id => !scopeIds.has(id));
      saveRequestedIds(next);
      return next;
    });
  };

  const nextRotation = getRotatingLocationTemplate(activeTemplates, rotationCursor);
  const nextMsg = nextPendingItem
    ? formatLocationRequestMessage(
        nextRotation.template,
        nextPendingItem.originalNumber,
        nextPendingItem.recipientName
      )
    : '';
  const nextUrl = nextPendingItem ? buildWhatsAppUrl(nextPendingItem.phone, nextMsg) : null;

  const handleSendNext = () => {
    if (!nextPendingItem || !nextUrl) return;
    markAsRequested(nextPendingItem.id);
    const link = document.createElement('a');
    link.href = nextUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveTemplates = () => {
    const saved = saveLocationRequestTemplates(templatesDraft);
    setTemplatesDraft(saved);
    setTemplateSaved(true);
    setTimeout(() => setTemplateSaved(false), 1800);
  };

  let pendingRankCounter = 0;

  return (
    <div className="fixed inset-0 z-[1150] bg-black/60 dark:bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-green-50 dark:bg-green-950/40 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-green-600 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0">
              <Send className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-gray-900 dark:text-slate-100 truncate">
                Pedir Ubicaciones por WhatsApp
              </h2>
              <p className="text-xs text-green-800 dark:text-green-300 truncate tabular-nums">
                {sentCountInScope} de {activeList.length} solicitado(s) · {activeTemplates.length} mensajes rotativos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-green-100/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Scope Tabs */}
          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setScope('missing')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                scope === 'missing'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Sin ubicación ({missingLocWithPhone.length})
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                scope === 'all'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Todos con teléfono ({itemsWithPhone.length})
            </button>
          </div>

          {/* Primary Sequential Send Button */}
          {activeList.length > 0 && (
            nextPendingItem && nextUrl ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleSendNext}
                  className="w-full bg-green-600 hover:bg-green-700 active:scale-[0.99] text-white py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 transition-all"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    Enviar al siguiente: #{nextPendingItem.originalNumber}
                    {nextPendingItem.recipientName ? ` · ${nextPendingItem.recipientName}` : ''}
                  </span>
                </button>
                <div className="flex items-start gap-1.5 px-2 text-[11px] text-gray-600 dark:text-slate-300">
                  <Shuffle className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                  <p className="leading-snug">
                    <span className="font-bold text-green-700 dark:text-green-300 tabular-nums">
                      Mensaje {nextRotation.templateIndex + 1} de {activeTemplates.length}:
                    </span>{' '}
                    <span className="text-gray-500 dark:text-slate-400">&ldquo;{nextMsg}&rdquo;</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                      ¡Todas las ubicaciones solicitadas!
                    </p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      Cuando te respondan, toca &quot;Pegar ubic.&quot; en cada paquete.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetRequested}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700 text-[11px] font-bold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100/60 dark:hover:bg-slate-700 flex items-center gap-1 shrink-0 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reiniciar</span>
                </button>
              </div>
            )
          )}

          {/* Collapsible Rotating Preset Templates Editor */}
          <div className="border border-gray-200 dark:border-slate-700/80 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTemplateEditor(prev => !prev)}
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800/70 flex items-center justify-between text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span>Mensajes preestablecidos rotativos ({activeTemplates.length})</span>
              {showTemplateEditor ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showTemplateEditor && (
              <div className="p-3.5 space-y-3 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800">
                <WhatsAppTemplatesEditor
                  templates={templatesDraft}
                  onChange={setTemplatesDraft}
                  compact
                />
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleSaveTemplates}
                    className="px-3.5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold flex items-center gap-1 transition-colors"
                  >
                    {templateSaved && <Check className="w-3 h-3" />}
                    <span>{templateSaved ? 'Mensajes guardados' : 'Guardar mensajes'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* List of Packages */}
          {activeList.length === 0 ? (
            <div className="bg-gray-50 dark:bg-slate-800/60 border border-dashed border-gray-300 dark:border-slate-700 rounded-2xl p-6 text-center space-y-2">
              <div className="w-11 h-11 bg-green-100 dark:bg-green-950/70 text-green-700 dark:text-green-300 rounded-2xl flex items-center justify-center mx-auto">
                <MapPin className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-gray-800 dark:text-slate-200">
                {scope === 'missing'
                  ? 'No hay paquetes pendientes de ubicación con teléfono'
                  : 'No hay paquetes con número de teléfono válido'}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {scope === 'missing' && itemsWithPhone.length > 0
                  ? 'Cambia a "Todos con teléfono" arriba si deseas volver a escribirles.'
                  : 'Agrega el número de teléfono al crear cada paquete para enviarles el mensaje automático.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-0.5">
              {activeList.map((item, idx) => {
                const isSent = requestedSet.has(item.id);
                const isIncomplete = item.hasLocation === false || item.coverageStatus === 'incomplete';
                const rowRotationIndex = isSent ? rotationCursor + idx : rotationCursor + pendingRankCounter++;
                const { template: rowTemplate, templateIndex } = getRotatingLocationTemplate(
                  activeTemplates,
                  rowRotationIndex
                );
                const msg = formatLocationRequestMessage(
                  rowTemplate,
                  item.originalNumber,
                  item.recipientName
                );
                const waUrl = buildWhatsAppUrl(item.phone, msg);

                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-2.5 transition-colors ${
                      isSent
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-800/80'
                        : 'bg-white dark:bg-slate-800/70 border-gray-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className={`w-8 h-8 rounded-xl text-[11px] font-black flex items-center justify-center shrink-0 ${
                          isSent
                            ? 'bg-emerald-600 text-white'
                            : isIncomplete
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-900 dark:bg-slate-700 text-white'
                        }`}
                      >
                        {isSent ? <Check className="w-4 h-4" /> : `#${item.originalNumber}`}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold text-gray-900 dark:text-slate-100 truncate">
                          #{item.originalNumber} {item.recipientName ? `· ${item.recipientName}` : ''}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate tabular-nums">
                          {item.phone} · {isSent ? 'Solicitado' : `Mensaje ${templateIndex + 1}/${activeTemplates.length}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isIncomplete && (
                        <button
                          type="button"
                          onClick={() => onEditItem(item)}
                          className="px-2.5 py-2 min-h-[38px] rounded-xl text-[11px] font-bold bg-orange-50 dark:bg-orange-950/60 hover:bg-orange-100 dark:hover:bg-orange-900/70 text-orange-800 dark:text-orange-200 border border-orange-200 dark:border-orange-700 flex items-center gap-1 transition-colors"
                          title="Pegar ubicación recibida"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Pegar ubic.</span>
                        </button>
                      )}
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => markAsRequested(item.id)}
                          className={`px-3 py-2 min-h-[38px] rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors ${
                            isSent
                              ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                              : 'bg-green-600 hover:bg-green-700 text-white shadow-xs'
                          }`}
                        >
                          <Send className="w-3 h-3" />
                          <span>{isSent ? 'Reenviar' : 'Enviar'}</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {itemsWithoutValidPhone.length > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 rounded-xl px-3 py-2">
              <PhoneOff className="w-3.5 h-3.5 shrink-0" />
              <span>
                {itemsWithoutValidPhone.length} paquete(s) sin ubicación no tienen teléfono válido para WhatsApp.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50 dark:bg-slate-800/80 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          {sentCountInScope > 0 ? (
            <button
              type="button"
              onClick={handleResetRequested}
              className="px-3 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-700/60 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar enviados</span>
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-200/60 dark:hover:bg-slate-700/60 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
