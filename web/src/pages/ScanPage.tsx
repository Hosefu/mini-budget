import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import QrScanner from 'qr-scanner'


type ScanMode = 'camera' | 'upload' | 'manual'

export default function ScanPage() {
  const [mode, setMode] = useState<ScanMode | null>(null)
  const [qrInput, setQrInput] = useState('')
  const [success, setSuccess] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [qrScanner, setQrScanner] = useState<QrScanner | null>(null)
  const [isProcessingQR, setIsProcessingQR] = useState(false)  // Защита от повторных обращений
  const videoRef = useRef<HTMLVideoElement>(null)
  const queryClient = useQueryClient()

  const processQRMutation = useMutation({
    mutationFn: api.processQR,
    onSuccess: (data) => {
      console.log('🎉 QR обработан успешно:', data)
      setSuccess(data.message)
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['balance'] })
      setIsProcessingQR(false)
      
      // Возвращаемся в меню через 3 секунды
      setTimeout(() => {
        resetToMenu()
      }, 3000)
    },
    onError: (error) => {
      console.error('❌ Ошибка обработки QR:', error)
      setIsProcessingQR(false)
    }
  })

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (qrInput.trim()) {
      processQRMutation.mutate(qrInput.trim())
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      resetToMenu()
      return
    }

    setMode('upload')
    setIsScanning(true)
    setScanError('')

    try {
      console.log('🔍 Отправляем файл на сервер для QR сканирования:', file.name)
      
      // Отправляем файл на сервер для мощного QR сканирования
      const formData = new FormData()
      formData.append('image', file)
      
      const response = await fetch('/api/scan-qr', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })
      
      const result = await response.json()
      
      if (result.success && result.data) {
        console.log(`🎉 QR успешно декодирован на сервере методом ${result.method} (${result.methodName}):`, result.data.substring(0, 100) + '...')
        processQRMutation.mutate(result.data)
      } else {
        console.log('❌ Серверный QR сканер не смог найти код:', result.error)
        setScanError(result.error || 'QR код не найден на изображении. Убедитесь что QR код четко виден и попробуйте:\n• Более качественное фото\n• Лучшее освещение\n• QR код полностью в кадре\n\nИли введите данные вручную.')
        
        setTimeout(() => {
          resetToMenu()
        }, 5000)
      }

    } catch (error) {
      console.error('❌ Ошибка при отправке на сервер:', error)
      setScanError('Ошибка соединения с сервером. Проверьте интернет и попробуйте снова.')
      setTimeout(() => {
        resetToMenu()
      }, 3000)
    } finally {
      setIsScanning(false)
      // Очищаем input
      e.target.value = ''
    }
  }





  const startCameraScanning = async () => {
    if (!videoRef.current) return

    try {
      setIsScanning(true)
      setScanError('')

      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          // Защита от повторной обработки
          if (isProcessingQR) {
            console.log('QR уже обрабатывается, игнорируем...')
            return
          }
          
          console.log('QR код сканирован:', result.data)
          setIsProcessingQR(true)
          processQRMutation.mutate(result.data)
          stopScanning()
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 2,
          returnDetailedScanResult: true
        }
      )

      await scanner.start()
      setQrScanner(scanner)
    } catch (error) {
      console.error('Ошибка запуска камеры:', error)
      setScanError('Не удалось запустить камеру. Проверьте разрешения.')
      setIsScanning(false)
    }
  }

  const stopScanning = () => {
    if (qrScanner) {
      qrScanner.stop()
      qrScanner.destroy()
      setQrScanner(null)
    }
    setIsScanning(false)
  }

  const resetToMenu = () => {
    stopScanning()
    setMode(null)
    setQrInput('')
    setSuccess('')
    setScanError('')
    setIsProcessingQR(false)
  }

  // Главное меню выбора способа сканирования
  if (!mode) {
    return (
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h2M4 4h5m0 0v5m0 0h5m0 0v5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Сканирование чека
          </h1>
          <p className="text-gray-600">
            Выберите способ ввода QR кода
          </p>
        </div>

        <div className="space-y-4">
          {/* Кнопка сканирования камерой */}
          <button
            onClick={() => setMode('camera')}
            className="w-full card hover:shadow-lg transition-shadow p-4"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="text-left flex-1">
                <h3 className="font-medium text-gray-900">Сканировать камерой</h3>
                <p className="text-sm text-gray-600">Наведите камеру на QR код</p>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Кнопка загрузки фото */}
          <label className="w-full card hover:shadow-lg transition-shadow p-4 cursor-pointer block">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-left flex-1">
                <h3 className="font-medium text-gray-900">Загрузить фото</h3>
                <p className="text-sm text-gray-600">Выберите фото с QR кодом</p>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Кнопка ручного ввода */}
          <button
            onClick={() => setMode('manual')}
            className="w-full card hover:shadow-lg transition-shadow p-4"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div className="text-left flex-1">
                <h3 className="font-medium text-gray-900">Ввести вручную</h3>
                <p className="text-sm text-gray-600">Скопировать или ввести QR данные</p>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>

        <div className="mt-8">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <h4 className="font-medium mb-2 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Как получить QR код:
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-xs text-left">
              <li>Найдите QR код внизу чека (обычно рядом с суммой)</li>
              <li>Выберите любой способ выше</li>
              <li>Система автоматически загрузит товары из ФНС</li>
              <li>AI классифицирует товары по категориям</li>
              <li>Готово! Можно редактировать кто сколько заплатил</li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  // Экран сканирования камерой
  if (mode === 'camera') {
    return (
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            Сканирование QR
          </h1>
          <p className="text-gray-600 text-sm">
            Наведите камеру на QR код чека
          </p>
        </div>

        <div className="card overflow-hidden">
          {/* Видео контейнер */}
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            
            {/* Оверлей с инструкциями */}
            {!isScanning && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <div className="text-center text-white p-4">
                  <div className="w-12 h-12 mx-auto mb-2 bg-white/20 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-sm">Нажмите "Запустить камеру"</p>
                </div>
              </div>
            )}
            
            {/* Индикатор сканирования */}
            {isScanning && (
              <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center">
                <svg className="w-3 h-3 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Ищем QR код...
              </div>
            )}
          </div>

          {/* Ошибки */}
          {scanError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{scanError}</p>
            </div>
          )}

          {/* Кнопки управления */}
          <div className="mt-4 flex space-x-3">
            <button
              onClick={resetToMenu}
              className="flex-1 btn btn-secondary flex items-center justify-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Назад
            </button>
            {!isScanning ? (
              <button
                onClick={startCameraScanning}
                className="flex-1 btn btn-primary flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Запустить камеру
              </button>
            ) : (
              <button
                onClick={stopScanning}
                className="flex-1 btn btn-danger flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Остановить
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 text-center">
          <div className="text-xs text-gray-600 bg-green-50 rounded-lg p-3 flex items-center">
            <svg className="w-4 h-4 text-green-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span><strong>Совет:</strong> Держите телефон ровно и убедитесь что QR код полностью виден в кадре</span>
          </div>
        </div>
      </div>
    )
  }

  // Экран загрузки файла
  if (mode === 'upload') {
    return (
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Обработка изображения
          </h1>
          <p className="text-gray-600">
            Сканируем QR код с загруженного фото...
          </p>
        </div>

        <div className="card p-8 text-center">
          {isScanning ? (
            <div className="space-y-4">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-600">Анализируем изображение...</p>
              <p className="text-xs text-gray-500">Пробуем разные методы обработки</p>
              <div className="text-xs text-gray-400 space-y-1">
                <div>• Стандартное сканирование</div>
                <div>• Увеличение контрастности</div>
                <div>• Улучшение резкости</div>
                <div>• Масштабирование</div>
              </div>
            </div>
          ) : processQRMutation.isPending ? (
            <div className="space-y-4">
              <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-600">Обрабатываем чек...</p>
              <p className="text-xs text-gray-500">Загружаем данные из ФНС</p>
            </div>
          ) : success ? (
            <div className="space-y-4">
              <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-green-600 font-medium">Готово!</p>
              <p className="text-sm text-gray-600">{success}</p>
            </div>
          ) : processQRMutation.error ? (
            <div className="space-y-4">
              <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-red-600 font-medium">Ошибка</p>
              <p className="text-sm text-gray-600">{(processQRMutation.error as Error).message}</p>
            </div>
          ) : scanError ? (
            <div className="space-y-4">
              <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-red-600 font-medium">QR не найден</p>
              <p className="text-sm text-gray-600">{scanError}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">QR код найден</p>
              <p className="text-xs text-gray-500">Обрабатываем данные чека...</p>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <button 
            onClick={resetToMenu} 
            className="btn btn-secondary flex items-center justify-center mx-auto"
            disabled={isScanning}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Назад к выбору способа
          </button>
        </div>
      </div>
    )
  }

  // Экран ручного ввода
  if (mode === 'manual') {
    return (
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Ручной ввод QR
          </h1>
          <p className="text-gray-600">
            Введите или вставьте данные QR кода
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                QR код с чека
              </label>
              <textarea
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                className="input min-h-[120px]"
                placeholder="t=20250630T1736&s=1620.64&fn=7380440801199300&i=125393&fp=2940285335&n=1"
                rows={4}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Скопируйте строку из QR кода или введите параметры вручную
              </p>
            </div>

            {processQRMutation.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">
                  {(processQRMutation.error as Error).message}
                </p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-600 text-sm">{success}</p>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={resetToMenu}
                className="flex-1 btn btn-secondary flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Назад
              </button>
              <button
                type="submit"
                disabled={!qrInput.trim() || processQRMutation.isPending}
                className="flex-1 btn btn-primary flex items-center justify-center"
              >
                {processQRMutation.isPending ? (
                  <>
                    <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Обработка...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h2M4 4h5m0 0v5m0 0h5m0 0v5" />
                    </svg>
                    Обработать QR
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Скрытый элемент для html5-qrcode */}
      <div id="temp-qr-reader" style={{ display: 'none' }}></div>
    </>
  )
} 