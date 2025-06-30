import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import decodeQR from 'qr/decode.js';
import { Bitmap } from 'qr';

const router = Router();

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения'));
    }
  }
});

// QR Code scanning endpoint - теперь на бэкенде!
router.post('/scan-qr', upload.single('image'), async (req: Request & { file?: any }, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл изображения не предоставлен' });
    }

    console.log('🔍 Обрабатываем QR файл:', req.file.originalname);
    
    // Обрабатываем изображение с множественными техниками улучшения
    const originalBuffer = req.file.buffer;
    
    const enhancementMethods = [
      // Оригинальное изображение
      {
        name: 'Оригинал',
        process: async (buffer: Buffer) => buffer
      },
      
             // Увеличение контрастности и резкости
       {
         name: 'Контраст + резкость',
         process: async (buffer: Buffer) => sharp(buffer)
           .greyscale()
           .normalize()
           .modulate({ brightness: 1.2, saturation: 1.8 })
           .sharpen({ sigma: 1, m1: 0.5, m2: 2 })
           .png()
           .toBuffer()
       },
      
      // Высокий контраст черно-белое
      {
        name: 'Черно-белое пороговое',
        process: async (buffer: Buffer) => sharp(buffer)
          .greyscale()
          .normalise()
          .threshold(120)
          .png()
          .toBuffer()
      },
      
      // Адаптивное пороговое значение
      {
        name: 'Адаптивное пороговое',
        process: async (buffer: Buffer) => sharp(buffer)
          .greyscale()
          .blur(0.3)
          .sharpen()
          .normalise()
          .threshold(100)
          .png()
          .toBuffer()
      },
      
      // Улучшение краев
      {
        name: 'Улучшение краев',
        process: async (buffer: Buffer) => sharp(buffer)
          .greyscale()
          .convolve({
            width: 3,
            height: 3,
            kernel: [-1, -1, -1, -1, 9, -1, -1, -1, -1]
          })
          .normalise()
          .png()
          .toBuffer()
      },
      
             // Морфологические операции
       {
         name: 'Морфологические операции',
         process: async (buffer: Buffer) => sharp(buffer)
           .greyscale()
           .blur(0.5)
           .normalise()
           .modulate({ brightness: 1.3, saturation: 2.0 })
           .threshold(115)
           .png()
           .toBuffer()
       }
    ];

    for (let i = 0; i < enhancementMethods.length; i++) {
      const method = enhancementMethods[i];
      try {
        console.log(`🔧 Пробуем метод ${i + 1}/${enhancementMethods.length}: ${method.name}`);
        
        const processedBuffer = await method.process(originalBuffer);
        
        // Получаем метаданные изображения
        const metadata = await sharp(processedBuffer).metadata();
        if (!metadata.width || !metadata.height) {
          console.log(`❌ Метод ${i + 1}: Не удалось получить размеры изображения`);
          continue;
        }

        // Конвертируем в raw pixel data  
        const { data, info } = await sharp(processedBuffer)
          .raw()
          .toBuffer({ resolveWithObject: true });

        // Создаем bitmap для QR декодера
        const bitmap = new Bitmap({ 
          width: info.width, 
          height: info.height 
        });
        
        // Конвертируем raw данные в 2D массив для qr библиотеки
        const channels = info.channels;
        const bmBits: number[][] = [];
        
        for (let y = 0; y < info.height; y++) {
          const row: number[] = [];
          for (let x = 0; x < info.width; x++) {
            const pixelIndex = (y * info.width + x) * channels;
            const value = channels === 1 ? data[pixelIndex] : 
                         Math.round(0.299 * data[pixelIndex] + 0.587 * data[pixelIndex + 1] + 0.114 * data[pixelIndex + 2]);
            // Инвертируем для лучшего распознавания
            row.push(value > 128 ? 1 : 0);
          }
          bmBits.push(row);
        }
        
        bitmap.data = bmBits as any;

        // Пытаемся декодировать QR
        const decoded = decodeQR(bitmap.toImage());
        
        if (decoded && decoded.trim()) {
          console.log(`🎉 QR успешно декодирован методом ${i + 1} (${method.name}):`, decoded.substring(0, 100) + '...');
          return res.json({ 
            success: true, 
            data: decoded,
            method: i + 1,
            methodName: method.name
          });
        } else {
          console.log(`❌ Метод ${i + 1}: QR не найден или пустой`);
        }
      } catch (error: any) {
        console.log(`❌ Метод ${i + 1} (${method.name}) не сработал:`, error.message);
        continue;
      }
    }

    // Если все методы не сработали
    console.log('😞 Все методы обработки не смогли найти QR код');
    return res.json({ 
      success: false, 
      error: 'QR код не найден или не читается в этом изображении. Попробуйте сфотографировать код четче при хорошем освещении.' 
    });

  } catch (error: any) {
    console.error('💥 Ошибка QR сканирования:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка обработки изображения' 
    });
  }
});

export default router; 