import { Santri, Lembaga, Kelas } from '../types';

export function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

export function demoteSantriToCalonPesertaDidik(
  santri: Santri,
  lembagasList?: Lembaga[],
  kelasList?: Kelas[]
): Santri {
  const currentClasses = santri.kelas
    ? santri.kelas.split(',').map(x => x.trim()).filter(Boolean)
    : [];

  // Identify formal lembagas
  const formalLembagaIds: string[] = [];
  let formalLembagas: Lembaga[] = [];
  if (lembagasList) {
    formalLembagas = lembagasList.filter(l => {
      if (l.jenis) return l.jenis === 'Formal';
      const lower = (l.nama || '').toLowerCase();
      return !lower.includes('madin') && !lower.includes('diniyah') && !lower.includes('tpq') &&
             !lower.includes('tahfidz') && !lower.includes('pondok') && !lower.includes('kitab') &&
             !lower.includes('internal');
    });
    formalLembagaIds.push(...formalLembagas.map(l => String(l.id)));
  }

  // Identify formal class names
  const formalClassNamesSet = new Set<string>();
  if (kelasList && formalLembagaIds.length > 0) {
    kelasList.forEach(k => {
      const lemId = String(k.lembagaId || (k as any).lembaga_id || '');
      if (formalLembagaIds.includes(lemId) && k.nama) {
        formalClassNamesSet.add(k.nama.trim().toLowerCase());
      }
    });
  }

  // Filter out formal classes & old default labels from currentClasses
  const nonFormalClasses = currentClasses.filter(c => {
    const lower = c.toLowerCase();
    if (lower === 'tanpa kelas' || lower === 'calon peserta didik' || lower === 'calon pelajar') {
      return false;
    }
    if (formalClassNamesSet.has(lower)) {
      return false;
    }
    return true;
  });

  // Combine 'Calon Peserta Didik' + non-formal classes
  const newClasses = Array.from(new Set(['Calon Peserta Didik', ...nonFormalClasses]));
  const finalKelasString = newClasses.join(', ');

  // Update pendidikanFormal
  let newFormal = santri.pendidikanFormal;
  if (santri.pendidikanFormal && santri.pendidikanFormal.trim() !== '') {
    const parts = santri.pendidikanFormal.split(' - ');
    const lemName = parts[0].trim();
    if (lemName) {
      newFormal = `${lemName} - Calon Peserta Didik`;
    } else {
      newFormal = 'Calon Peserta Didik';
    }
  } else if (formalLembagas.length > 0) {
    let matchedLem: Lembaga | undefined;
    if (kelasList && currentClasses.length > 0) {
      for (const cName of currentClasses) {
        const foundCls = kelasList.find(k => k.nama.trim().toLowerCase() === cName.toLowerCase());
        if (foundCls) {
          const lemId = String(foundCls.lembagaId || (foundCls as any).lembaga_id || '');
          matchedLem = formalLembagas.find(l => String(l.id) === lemId);
          if (matchedLem) break;
        }
      }
    }
    if (matchedLem) {
      newFormal = `${matchedLem.nama} - Calon Peserta Didik`;
    }
  }

  return {
    ...santri,
    statusEmis: 'Belum',
    kelas: finalKelasString,
    pendidikanFormal: newFormal || undefined,
  };
}

export function compressImage(file: File, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Use image/png for PNG to preserve transparency, otherwise image/jpeg for smaller file size
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const compressedBase64 = canvas.toDataURL(mimeType, file.type === 'image/png' ? undefined : quality);
        resolve(compressedBase64);
      };
      img.onerror = (err) => reject(err);
      img.src = event.target?.result as string;
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}
