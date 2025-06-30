import { Request, Response, Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
const qrnode = require('qrnode'); // Используем require для CommonJS
import { promisify } from 'util';

const router = Router();

// Конфигурация multer для загрузки файлов
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения разрешены!'));
    }
  },
});

// Превращаем callback-based функцию в Promise
const qrDetect = promisify(qrnode.detect);

// Методы обработки изображений для улучшения QR сканирования
const processingMethods = [
  {
    name: 'Оригинал',
    process: async (buffer: Buffer) => buffer
  },
  {
    name: 'Контраст + резкость',
    process: async (buffer: Buffer) => {
      return await sharp(buffer)
        .modulate({ brightness: 1.1, saturation: 0.8 })
        .sharpen()
        .toBuffer();
    }
  },
  {
    name: 'Черно-белое пороговое',
    process: async (buffer: Buffer) => {
      return await sharp(buffer)
        .greyscale()
        .threshold(128)
        .toBuffer();
    }
  },
  {
    name: 'Адаптивное пороговое',
    process: async (buffer: Buffer) => {
      return await sharp(buffer)
        .greyscale()
        .normalise()
        .toBuffer();
    }
  },
  {
    name: 'Улучшение краев',
    process: async (buffer: Buffer) => {
      return await sharp(buffer)
        .greyscale()
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
        })
        .toBuffer();
    }
  },
  {
    name: 'Морфологические операции',
    process: async (buffer: Buffer) => {
      return await sharp(buffer)
        .greyscale()
        .blur(0.5)
        .threshold(100)
        .toBuffer();
    }
  }
];

// Функция для попытки декодирования QR кода с разными методами обработки
async function tryDecodeQR(buffer: Buffer, filename: string) {
  console.log(`🔍 Обрабатываем QR файл: ${filename}`);
  
  for (let i = 0; i < processingMethods.length; i++) {
    const method = processingMethods[i];
    console.log(`🔧 Пробуем метод ${i + 1}/${processingMethods.length}: ${method.name}`);
    
    try {
      // Обрабатываем изображение согласно методу
      const processedBuffer = await method.process(buffer);
      
      // Сохраняем во временный файл для qrnode
      const tempPath = `/tmp/qr_temp_${Date.now()}.png`;
      await sharp(processedBuffer).png().toFile(tempPath);
      
      // Пытаемся декодировать QR
      const decoded = await qrDetect(tempPath);
      
      // Удаляем временный файл
      const fs = require('fs');
      try {
        fs.unlinkSync(tempPath);
      } catch (e) {
        // Игнорируем ошибки удаления
      }
      
      if (decoded && decoded.trim()) {
        console.log(`🎉 QR успешно декодирован методом ${i + 1} (${method.name}):`, decoded.substring(0, 100) + '...');
        return {
          success: true,
          data: decoded,
          method: i + 1,
          methodName: method.name
        };
      } else {
        console.log(`❌ Метод ${i + 1} (${method.name}) не нашел QR код`);
      }
    } catch (error: any) {
      console.log(`❌ Метод ${i + 1} (${method.name}) не сработал:`, error.message);
    }
  }
  
  console.log('😞 Все методы обработки не смогли найти QR код');
  return {
    success: false,
    error: 'QR код не найден ни одним из методов обработки'
  };
}

// Endpoint для сканирования QR кода
router.post('/scan-qr', upload.single('image'), async (req: Request & { file?: any }, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Файл изображения не загружен'
      });
    }

    const result = await tryDecodeQR(req.file.buffer, req.file.originalname);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    console.error('❌ Ошибка при сканировании QR:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера при сканировании QR'
    });
  }
});

export default router; 