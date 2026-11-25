import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Upload, CheckCircle2, Share2, Download, Trash2, Mail, MessageCircle, Loader2, Send } from 'lucide-react';
import { DeliveryItem } from '../types';
import { compressImageToDataUrl, dataUrlToFile } from '../utils/imageUtils';
import { buildWhatsAppUrl } from '../utils/whatsappParser';

interface DeliveryPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: DeliveryItem | null;
  onSavePhoto: (id: string, photoDataUrl: string | undefined, markDelivered?: boolean) => void;
  readOnly?: boolean;
}

export const DeliveryPhotoModal: React.FC<DeliveryPhotoModalProps> = ({
  isOpen,
  onClose,
  item,
  onSavePhoto,
  readOnly = false
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [shareFeedback, setShareFeedback] = useState('');
  const [otherContact, setOtherContact] = useState<string>(() => {
    return localStorage.getItem('ruteo_forward_contact') || '';
  });

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && item) {
      setPreviewUrl(item.deliveryPhoto);
      setErrorMsg('');
      setShareFeedback('');
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    setErrorMsg('');
    setShareFeedback('');
    try {
      const compressed = await compressImageToDataUrl(file, 960, 0.72);
      setPreviewUrl(compressed);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al procesar la fotografía.');
    } finally {
      setProcessing(false);
      e.target.value = '';
    }
  };

  const handleSaveOtherContact = (val: string) => {
    setOtherContact(val);
    localStorage.setItem('ruteo_forward_contact', val);
  };

  const buildSummaryText = () => {
    const timeText = item.deliveryPhotoAt
      ? new Date(item.deliveryPhotoAt).toLocaleString('es-CR')
      : new Date().toLocaleString('es-CR');
    return `Comprobante de entrega - Paquete #${item.originalNumber}\nDirección: ${item.address}\nFecha: ${timeText}`;
  };

  const handleNativeShare = async () => {
    if (!previewUrl) return;
    setShareFeedback('');
    try {
      const file = await dataUrlToFile(previewUrl, `entrega-paquete-${item.originalNumber}.jpg`);
      const nav = navigator as any;
      if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
        await nav.share({
          title: `Foto de entrega #${item.originalNumber}`,
          text: buildSummaryText(),
          files: [file]
        });
        setShareFeedback('Foto compartida correctamente.');
        return;
      }
      if (nav.share) {
        await nav.share({
          title: `Foto de entrega #${item.originalNumber}`,
          text: buildSummaryText()
        });
        setShareFeedback('Comprobante compartido. Descarga la foto si tu navegador no adjuntó la imagen.');
        return;
      }
      setShareFeedback('Tu navegador no admite compartir directo; usa Descargar o enviar a otro contacto.');
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setShareFeedback('No se pudo abrir el menú de compartir. Puedes descargar la foto para enviarla.');
      }
    }
  };

  const handleDownloadPhoto = () => {
    if (!previewUrl) return;
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = `entrega-paquete-${item.originalNumber}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShareFeedback('Foto descargada en el dispositivo.');
  };

  const handleForwardToSeparateContact = async () => {
    if (!previewUrl) return;
    const trimmed = otherContact.trim();
    if (!trimmed) {
      setShareFeedback('Ingresa un número o correo del contacto aparte para reenviar.');
      return;
    }

    // Try native share first if supported, otherwise open WhatsApp/Email to the separate contact and download photo
    const isEmail = trimmed.includes('@');
    handleDownloadPhoto();

    if (isEmail) {
      const subject = encodeURIComponent(`Foto de entrega - Paquete #${item.originalNumber}`);
      const body = encodeURIComponent(`${buildSummaryText()}\n\n(Adjunta la imagen descargada: entrega-paquete-${item.originalNumber}.jpg)`);
      const mailLink = document.createElement('a');
      mailLink.href = `mailto:${encodeURIComponent(trimmed)}?subject=${subject}&body=${body}`;
      mailLink.click();
      setShareFeedback('Foto descargada y correo preparado para el contacto.');
      return;
    }

    const waUrl = buildWhatsAppUrl(trimmed);
    if (waUrl) {
      const msg = encodeURIComponent(buildSummaryText());
      const a = document.createElement('a');
      a.href = `${waUrl}?text=${msg}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
      setShareFeedback('Foto descargada y chat abierto con el contacto aparte.');
    } else {
      setShareFeedback('Contacto inválido. Ingresa un teléfono o correo válido.');
    }
  };

  return (
    <div className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-emerald-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-sm">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">Foto de Entrega #{item.originalNumber}</h2>
              <p className="text-xs text-emerald-800 truncate max-w-[230px]">
                {readOnly
                  ? `Solo lectura • ${item.assignedDriverName || 'Otro conductor'}`
                  : item.address}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-emerald-100/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden Inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelected}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelected}
          className="hidden"
        />

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-xl text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Photo Preview or Capture Prompt */}
          {processing ? (
            <div className="h-56 bg-gray-50 border-2 border-dashed border-emerald-300 rounded-2xl flex flex-col items-center justify-center gap-2 text-emerald-700">
              <Loader2 className="w-7 h-7 animate-spin" />
              <span className="text-xs font-bold">Procesando fotografía...</span>
            </div>
          ) : previewUrl ? (
            <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-950">
              <img
                src={previewUrl}
                alt={`Entrega paquete #${item.originalNumber}`}
                className="w-full max-h-64 object-contain mx-auto"
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setPreviewUrl(undefined)}
                  className="absolute top-2.5 right-2.5 bg-red-600/90 hover:bg-red-700 text-white p-2 rounded-xl shadow-md transition-colors"
                  title="Quitar foto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="h-48 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-3 p-4 text-center">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800">Sin foto de entrega</p>
                <p className="text-[11px] text-gray-500">
                  {readOnly
                    ? 'Este paquete pertenece a otro conductor y no tiene foto aún.'
                    : 'Toma una foto con la cámara o selecciona una imagen.'}
                </p>
              </div>
            </div>
          )}

          {/* Capture / Upload buttons */}
          {!readOnly && (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <Camera className="w-4 h-4" />
                <span>{previewUrl ? 'Tomar otra' : 'Tomar Foto'}</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-gray-200 transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Subir Imagen</span>
              </button>
            </div>
          )}

          {/* Forward / Share Section */}
          {previewUrl && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-black text-gray-800 flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-indigo-600" />
                <span>Reenviar foto a otro contacto (aparte de WhatsApp)</span>
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Otra App / Contacto</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPhoto}
                  className="bg-white hover:bg-gray-100 text-gray-800 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-gray-300 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Foto</span>
                </button>
              </div>

              <div className="space-y-1.5 pt-1 border-t border-gray-200">
                <label className="text-[11px] font-bold text-gray-600 block">
                  Contacto aparte (teléfono o correo):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={otherContact}
                    onChange={e => handleSaveOtherContact(e.target.value)}
                    placeholder="Ej. 8888-9999 o despacho@correo.com"
                    className="flex-1 bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleForwardToSeparateContact}
                    className="bg-gray-900 hover:bg-gray-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 transition-colors"
                    title="Reenviar foto al contacto aparte"
                  >
                    {otherContact.includes('@') ? (
                      <Mail className="w-3.5 h-3.5" />
                    ) : (
                      <MessageCircle className="w-3.5 h-3.5" />
                    )}
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {shareFeedback && (
                <p className="text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1.5">
                  {shareFeedback}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200/60 transition-colors"
          >
            Cerrar
          </button>

          {!readOnly && previewUrl && item.status !== 'delivered' && (
            <button
              type="button"
              onClick={() => {
                onSavePhoto(item.id, previewUrl, true);
                onClose();
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Guardar y Entregar</span>
            </button>
          )}

          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                onSavePhoto(item.id, previewUrl, false);
                onClose();
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md transition-colors"
            >
              Guardar Foto
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
