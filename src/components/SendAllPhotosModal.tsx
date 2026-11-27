import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Images,
  MessageCircle,
  Download,
  Copy,
  Check,
  Loader2,
  Camera
} from 'lucide-react';
import { DeliveryItem } from '../types';
import { combinePhotosIntoGridBlob, dataUrlToFile } from '../utils/imageUtils';
import { buildWhatsAppUrl } from '../utils/whatsappParser';

interface SendAllPhotosModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: DeliveryItem[];
}

const PHOTOS_WHATSAPP_STORAGE_KEY = 'ruteo_photos_whatsapp_phone';

export const SendAllPhotosModal: React.FC<SendAllPhotosModalProps> = ({
  isOpen,
  onClose,
  items,
}) => {
  const photoItems = useMemo(() => {
    return items
      .filter(i => Boolean(i.deliveryPhoto))
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [items]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [whatsappPhone, setWhatsappPhone] = useState<string>(() => {
    return localStorage.getItem(PHOTOS_WHATSAPP_STORAGE_KEY) || '';
  });
  const [busyAction, setBusyAction] = useState<'share' | 'copy' | 'download' | null>(null);
  const [feedback, setFeedback] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(photoItems.map(i => i.id));
      setFeedback('');
      setBusyAction(null);
    }
  }, [isOpen, photoItems]);

  if (!isOpen) return null;

  const selectedItems = photoItems.filter(i => selectedIds.includes(i.id));

  const handlePhoneChange = (val: string) => {
    setWhatsappPhone(val);
    try {
      localStorage.setItem(PHOTOS_WHATSAPP_STORAGE_KEY, val);
    } catch {
      // ignore storage errors
    }
  };

  const toggleItemSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedItems.length === photoItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(photoItems.map(i => i.id));
    }
  };

  const getDirectWhatsAppUrl = () => {
    const trimmed = whatsappPhone.trim();
    if (!trimmed) return 'https://wa.me/';
    return buildWhatsAppUrl(trimmed) || 'https://wa.me/';
  };

  const openWhatsAppChatNoText = () => {
    const url = getDirectWhatsAppUrl();
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Send all selected photos together as multiple attachments with NO text message
  const handleShareAllPhotosTogether = async () => {
    if (selectedItems.length === 0) return;
    setBusyAction('share');
    setFeedback('');

    try {
      const files = await Promise.all(
        selectedItems.map((item, idx) =>
          dataUrlToFile(
            item.deliveryPhoto as string,
            `paquete-${item.originalNumber || idx + 1}.jpg`
          )
        )
      );

      const nav = navigator as any;
      if (nav.share && (!nav.canShare || nav.canShare({ files }))) {
        // Deliberately omit `text` and `title` so WhatsApp receives ONLY the photos
        await nav.share({ files });
        setFeedback(`${files.length} foto(s) enviadas juntas sin texto.`);
        return;
      }

      // Fallback when browser doesn't support sharing multiple files directly
      const blob = await combinePhotosIntoGridBlob(
        selectedItems.map(i => i.deliveryPhoto as string),
        'image/png'
      );
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        openWhatsAppChatNoText();
        setFeedback('Todas las fotos se copiaron como 1 imagen. Pégala (Ctrl+V) en WhatsApp.');
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `fotos-entregas-${selectedItems.length}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        openWhatsAppChatNoText();
        setFeedback('Imagen con todas las fotos descargada y WhatsApp abierto para adjuntarla.');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setFeedback('Tu navegador bloqueó el envío directo. Usa "Copiar todas como 1 imagen" o "Descargar".');
      }
    } finally {
      setBusyAction(null);
    }
  };

  // Combine all photos into 1 single image, copy to clipboard, and open WhatsApp with zero text
  const handleCopyCombinedAndOpenWhatsApp = async () => {
    if (selectedItems.length === 0) return;
    setBusyAction('copy');
    setFeedback('');

    try {
      const blob = await combinePhotosIntoGridBlob(
        selectedItems.map(i => i.deliveryPhoto as string),
        'image/png'
      );

      let copiedToClipboard = false;
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          copiedToClipboard = true;
        } catch {
          copiedToClipboard = false;
        }
      }

      if (!copiedToClipboard) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `fotos-entregas-${selectedItems.length}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      openWhatsAppChatNoText();
      setFeedback(
        copiedToClipboard
          ? '1 imagen con todas las fotos copiada. Solo pégala en el chat de WhatsApp.'
          : '1 imagen con todas las fotos descargada y chat de WhatsApp abierto.'
      );
    } catch {
      setFeedback('No se pudieron unir las fotografías.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownloadCombinedImage = async () => {
    if (selectedItems.length === 0) return;
    setBusyAction('download');
    setFeedback('');

    try {
      const blob = await combinePhotosIntoGridBlob(
        selectedItems.map(i => i.deliveryPhoto as string),
        'image/jpeg'
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fotos-entregas-${selectedItems.length}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setFeedback('Imagen con todas las fotos descargada.');
    } catch {
      setFeedback('No se pudo descargar la imagen.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownloadSeparate = () => {
    if (selectedItems.length === 0) return;
    selectedItems.forEach((item, idx) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = item.deliveryPhoto as string;
        link.download = `paquete-${item.originalNumber || idx + 1}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, idx * 140);
    });
    setFeedback(`Descargando ${selectedItems.length} fotografía(s) en el dispositivo.`);
  };

  return (
    <div className="fixed inset-0 z-[1250] bg-black/60 dark:bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-green-50 dark:bg-green-950/40 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-green-600 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0">
              <Images className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-gray-900 dark:text-slate-100 truncate">
                Enviar Fotos a WhatsApp
              </h2>
              <p className="text-xs text-green-800 dark:text-green-300 truncate">
                {selectedItems.length} de {photoItems.length} foto(s) · Sin texto, en 1 solo envío
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
          {photoItems.length === 0 ? (
            <div className="bg-gray-50 dark:bg-slate-800/70 border border-dashed border-gray-300 dark:border-slate-700 rounded-2xl p-8 text-center space-y-2.5">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-950/70 text-green-700 dark:text-green-300 rounded-2xl flex items-center justify-center mx-auto">
                <Camera className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-gray-800 dark:text-slate-200">Aún no hay fotografías guardadas</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 max-w-xs mx-auto">
                Toma la foto en cada entrega y al finalizar podrás enviarlas todas juntas en un solo WhatsApp.
              </p>
            </div>
          ) : (
            <>
              {/* Optional target WhatsApp phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-slate-200 block">
                  WhatsApp destino (opcional):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="tel"
                    inputMode="tel"
                    value={whatsappPhone}
                    onChange={e => handlePhoneChange(e.target.value)}
                    placeholder="Ej. 8888-9999 (si lo dejas vacío eliges el chat)"
                    className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  />
                  {whatsappPhone && (
                    <button
                      type="button"
                      onClick={() => handlePhoneChange('')}
                      className="text-xs font-bold text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 px-2.5 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

              {/* Photo Selection Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 dark:text-slate-300">
                    Fotografías a enviar ({selectedItems.length}):
                  </span>
                  {photoItems.length > 1 && (
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      {selectedItems.length === photoItems.length ? 'Desmarcar todas' : 'Marcar todas'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
                  {photoItems.map(item => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleItemSelection(item.id)}
                        className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all ${
                          isSelected
                            ? 'border-green-500 ring-2 ring-green-500/25'
                            : 'border-gray-200 dark:border-slate-700 opacity-50'
                        }`}
                      >
                        <img
                          src={item.deliveryPhoto}
                          alt={`Paquete #${item.originalNumber}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-2 py-1 flex items-center justify-between">
                          <span className="text-[11px] font-black text-white">
                            #{item.originalNumber}
                          </span>
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center ${
                              isSelected ? 'bg-green-500 text-white' : 'bg-white/30 text-transparent'
                            }`}
                          >
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleShareAllPhotosTogether}
                  disabled={selectedItems.length === 0 || busyAction !== null}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 transition-all disabled:opacity-50"
                >
                  {busyAction === 'share' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MessageCircle className="w-4 h-4" />
                  )}
                  <span>
                    Enviar {selectedItems.length} {selectedItems.length === 1 ? 'foto' : 'fotos'} juntas a WhatsApp
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyCombinedAndOpenWhatsApp}
                  disabled={selectedItems.length === 0 || busyAction !== null}
                  className="w-full bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 py-3 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {busyAction === 'copy' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>Unir en 1 sola imagen y abrir WhatsApp</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadCombinedImage}
                    disabled={selectedItems.length === 0 || busyAction !== null}
                    className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Guardar 1 imagen</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadSeparate}
                    disabled={selectedItems.length === 0 || busyAction !== null}
                    className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Guardar por separado</span>
                  </button>
                </div>
              </div>

              {feedback && (
                <p className="text-xs font-semibold text-green-800 dark:text-green-200 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2 text-center">
                  {feedback}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50 dark:bg-slate-800/80 border-t border-gray-100 dark:border-slate-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-700/60 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
