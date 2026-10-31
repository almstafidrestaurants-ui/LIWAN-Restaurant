/* Gallery picker: compress to small JPEG data URLs for Firebase Spark Firestore. */
(() => {
  'use strict';
  async function compress(file) {
    if (!file || !file.type.startsWith('image/'))
      throw new Error('اختر ملف صورة من معرض الهاتف.');
    if (file.size > 15 * 1024 * 1024)
      throw new Error('حجم الصورة الأصلية أكبر من 15 ميغابايت.');
    const objectUrl = URL.createObjectURL(file);
    let image;
    try {
      image = new Image();
      image.src = objectUrl;
      if (typeof image.decode === 'function') await image.decode();
      else await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('الصورة غير صالحة.');
      let scale=Math.min(1,760/Math.max(image.naturalWidth,image.naturalHeight));
      for(let attempt=0; attempt<6; attempt++){
        const width=Math.max(1,Math.round(image.naturalWidth*scale));
        const height=Math.max(1,Math.round(image.naturalHeight*scale));
        const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
        const ctx=canvas.getContext('2d');
        if(!ctx)throw new Error('لا يمكن معالجة الصورة على هذا الجهاز.');
        ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);
        ctx.drawImage(image,0,0,width,height);
        for(const quality of [.78,.64,.51]){
          const result=canvas.toDataURL('image/jpeg',quality);
          if(result.startsWith('data:image/jpeg;base64,') && result.length<=115000)return result;
        }
        scale*=.78;
      }
      throw new Error('الصورة كبيرة جدًا بعد التصغير؛ اختر صورة أبسط.');
    } finally { URL.revokeObjectURL(objectUrl); }
  }
  window.LIWAN_PHOTO={compress};
})();
