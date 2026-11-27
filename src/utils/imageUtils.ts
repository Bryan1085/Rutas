function compressCanvasSource(
  source: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number,
  maxDimension: number,
  quality: number
): string {
  let width = Math.max(1, naturalWidth);
  let height = Math.max(1, naturalHeight);

  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      height = Math.max(1, Math.round((height * maxDimension) / width));
      width = maxDimension;
    } else {
      width = Math.max(1, Math.round((width * maxDimension) / height));
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo procesar la imagen.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);

  let currentQuality = quality;
  let dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
  while (dataUrl.length > 420000 && currentQuality > 0.3) {
    currentQuality = Math.max(0.3, currentQuality - 0.12);
    dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
  }
  return dataUrl;
}

export async function compressImageToDataUrl(
  file: File,
  maxDimension = 960,
  quality = 0.72
): Promise<string> {
  // Prefer createImageBitmap (low RAM on mobile cameras & honors EXIF orientation)
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        return compressCanvasSource(bitmap, bitmap.width, bitmap.height, maxDimension, quality);
      } finally {
        bitmap.close();
      }
    } catch {
      // Fall through to object URL / Image fallback
    }
  }

  // Fallback via ObjectURL (avoids huge FileReader DataURL in memory)
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    try {
      const objectUrl = URL.createObjectURL(file);
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error('El archivo no es una imagen válida.'));
          el.src = objectUrl;
        });
        return compressCanvasSource(
          img,
          img.naturalWidth || img.width,
          img.naturalHeight || img.height,
          maxDimension,
          quality
        );
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      // Fall through to FileReader fallback
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo no es una imagen válida.'));
      img.onload = () => {
        try {
          resolve(
            compressCanvasSource(
              img,
              img.naturalWidth || img.width,
              img.naturalHeight || img.height,
              maxDimension,
              quality
            )
          );
        } catch (err: any) {
          reject(err);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar una de las fotografías.'));
    img.src = src;
  });
}

export async function combinePhotosIntoGridBlob(
  dataUrls: string[],
  mimeType: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<Blob> {
  if (dataUrls.length === 0) {
    throw new Error('No hay fotografías seleccionadas.');
  }

  const images = await Promise.all(dataUrls.map(loadImageElement));
  const count = images.length;
  const cols = count === 1 ? 1 : count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);

  const cellWidth = count === 1 ? Math.min(images[0].naturalWidth || 960, 1200) : 520;
  const cellHeight = count === 1
    ? Math.round((cellWidth * (images[0].naturalHeight || 720)) / Math.max(images[0].naturalWidth || 960, 1))
    : 520;
  const gap = count === 1 ? 0 : 12;

  const canvas = document.createElement('canvas');
  canvas.width = cols * cellWidth + (cols + 1) * gap;
  canvas.height = rows * cellHeight + (rows + 1) * gap;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo generar la imagen combinada.');
  }

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  images.forEach((img, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = gap + col * (cellWidth + gap);
    const y = gap + row * (cellHeight + gap);

    if (count === 1) {
      ctx.drawImage(img, x, y, cellWidth, cellHeight);
      return;
    }

    // Center-fit photo inside cell without cropping important delivery details
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x, y, cellWidth, cellHeight);

    const scale = Math.min(cellWidth / Math.max(img.naturalWidth, 1), cellHeight / Math.max(img.naturalHeight, 1));
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const drawX = x + (cellWidth - drawW) / 2;
    const drawY = y + (cellHeight - drawH) / 2;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error('Error al exportar la imagen combinada.'));
      },
      mimeType,
      mimeType === 'image/jpeg' ? 0.88 : undefined
    );
  });
}
