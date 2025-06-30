import { Balance, utils } from '../services/api'
import { 
  CurrencyDollarIcon,
  UserIcon,
  ScaleIcon,
} from '@heroicons/react/24/outline'

interface BalanceCardProps {
  balance?: Balance
}

export default function BalanceCard({ balance }: BalanceCardProps) {
  if (!balance) {
    return (
      <div className="card animate-pulse">
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    )
  }

  const egorBalance = balance.egorBalance
  const syomaBalance = balance.syomaBalance

  // Вычисляем угол наклона "горизонта" воды (от -8 до +8 градусов)
  let waterTilt = 0
  const totalImbalance = Math.abs(egorBalance) + Math.abs(syomaBalance)
  
  if (totalImbalance > 100) { // показываем наклон только при существенном дисбалансе
    const maxTilt = 4 // максимальный наклон в градусах
    if (egorBalance > syomaBalance) {
      // Егор переплатил - вода наклоняется к нему (вправо)
      waterTilt = Math.min((egorBalance - syomaBalance) / 1000 * maxTilt, maxTilt)
    } else if (syomaBalance > egorBalance) {
      // Сёма переплатила - вода наклоняется к ней (влево)
      waterTilt = -Math.min((syomaBalance - egorBalance) / 1000 * maxTilt, maxTilt)
    }
  }

  // Правильная проверка баланса - оба должны быть близки к нулю
  const isBalanced = Math.abs(egorBalance) < 50 && Math.abs(syomaBalance) < 50

  return (
    <div className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 rounded-xl overflow-hidden shadow-lg">
      {/* Водная анимация на всю карточку */}
      <div className="absolute inset-0">
        {/* Основная вода с наклоном */}
        <div 
          className="absolute inset-0 transition-transform duration-1000 ease-out origin-center"
          style={{ 
            transform: `rotate(${waterTilt}deg) scale(1.5)`, // увеличиваем чтобы не видеть края
            background: 'linear-gradient(to bottom, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.2), rgba(29, 78, 216, 0.3))'
          }}
        >
          {/* Волны на поверхности - множественные слои */}
          <div className="absolute top-0 left-0 right-0 h-full overflow-hidden">
            {/* Волна 1 */}
            <svg 
              className="absolute top-0 left-0 w-full h-full animate-pulse opacity-60" 
              viewBox="0 0 400 100" 
              preserveAspectRatio="xMidYMid slice"
              style={{ 
                animationDuration: '3s',
                transform: 'translateY(20px)'
              }}
            >
              <path 
                d="M0,20 Q100,10 200,20 T400,20 Q600,10 800,20 V100 H-200 Z" 
                fill="rgba(147, 197, 253, 0.4)"
              />
            </svg>
            
            {/* Волна 2 - обратная */}
            <svg 
              className="absolute top-0 left-0 w-full h-full animate-pulse opacity-40" 
              viewBox="0 0 400 100" 
              preserveAspectRatio="xMidYMid slice"
              style={{ 
                animationDuration: '4s', 
                animationDelay: '1s',
                transform: 'translateY(30px)'
              }}
            >
              <path 
                d="M0,30 Q150,20 300,30 T600,30 Q900,20 1200,30 V100 H-300 Z" 
                fill="rgba(191, 219, 254, 0.3)"
              />
            </svg>

            {/* Волна 3 - быстрая */}
            <svg 
              className="absolute top-0 left-0 w-full h-full animate-pulse opacity-50" 
              viewBox="0 0 400 100" 
              preserveAspectRatio="xMidYMid slice"
              style={{ 
                animationDuration: '2.5s',
                animationDelay: '0.5s',
                transform: 'translateY(10px)'
              }}
            >
              <path 
                d="M0,15 Q80,5 160,15 T320,15 Q480,5 640,15 V100 H-160 Z" 
                fill="rgba(219, 234, 254, 0.5)"
              />
            </svg>
          </div>

          {/* Живые пузырьки */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Большие пузырьки */}
            {[...Array(8)].map((_, i) => (
              <div
                key={`big-${i}`}
                className="absolute bg-white/30 rounded-full animate-bounce"
                style={{
                  width: `${4 + Math.random() * 8}px`,
                  height: `${4 + Math.random() * 8}px`,
                  left: `${10 + Math.random() * 80}%`,
                  top: `${20 + Math.random() * 60}%`,
                  animationDuration: `${2 + Math.random() * 3}s`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDirection: Math.random() > 0.5 ? 'normal' : 'reverse',
                }}
              />
            ))}
            
            {/* Средние пузырьки */}
            {[...Array(12)].map((_, i) => (
              <div
                key={`medium-${i}`}
                className="absolute bg-white/40 rounded-full animate-pulse"
                style={{
                  width: `${2 + Math.random() * 4}px`,
                  height: `${2 + Math.random() * 4}px`,
                  left: `${5 + Math.random() * 90}%`,
                  top: `${10 + Math.random() * 80}%`,
                  animationDuration: `${1.5 + Math.random() * 2}s`,
                  animationDelay: `${Math.random() * 1.5}s`,
                }}
              />
            ))}
            
            {/* Мелкие пузырьки */}
            {[...Array(20)].map((_, i) => (
              <div
                key={`small-${i}`}
                className="absolute bg-white/50 rounded-full animate-ping"
                style={{
                  width: `${1 + Math.random() * 2}px`,
                  height: `${1 + Math.random() * 2}px`,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDuration: `${1 + Math.random() * 2}s`,
                  animationDelay: `${Math.random() * 3}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Контент поверх воды */}
      <div className="relative z-10 p-6">
        {/* Заголовок */}
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-1 flex items-center justify-center">
            <CurrencyDollarIcon className="w-6 h-6 text-blue-600 mr-2" />
            Семейный баланс
          </h3>
          <p className="text-sm text-gray-600">
            Общие траты: {utils.formatCurrency(balance.totalSpent)} • {balance.paymentsCount} платежей
          </p>
        </div>

        {/* Пользователи и балансы */}
        <div className="flex items-center justify-between mb-6">
          {/* Сёма слева */}
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-200 to-purple-300 rounded-full flex items-center justify-center mb-2 shadow-lg border-2 border-white/80 backdrop-blur-sm">
              <UserIcon className="w-6 h-6 text-purple-700" />
            </div>
            <div className="text-sm font-medium text-gray-700">Сёма</div>
            <div className={`text-sm font-bold ${utils.getBalanceClass(syomaBalance)}`}>
              {syomaBalance > 0 ? '+' : ''}{utils.formatCurrency(syomaBalance)}
            </div>
          </div>

          {/* Центральная иконка баланса */}
          <div className="text-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 border-2 border-white/80 shadow-lg backdrop-blur-sm ${
              isBalanced 
                ? 'bg-green-100/90 text-green-600' 
                : 'bg-amber-100/90 text-amber-600'
            }`}>
              {isBalanced ? (
                <ScaleIcon className="w-5 h-5" />
              ) : (
                <CurrencyDollarIcon className="w-5 h-5" />
              )}
            </div>
          </div>

          {/* Егор справа */}
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-200 to-indigo-300 rounded-full flex items-center justify-center mb-2 shadow-lg border-2 border-white/80 backdrop-blur-sm">
              <UserIcon className="w-6 h-6 text-indigo-700" />
            </div>
            <div className="text-sm font-medium text-gray-700">Егор</div>
            <div className={`text-sm font-bold ${utils.getBalanceClass(egorBalance)}`}>
              {egorBalance > 0 ? '+' : ''}{utils.formatCurrency(egorBalance)}
            </div>
          </div>
        </div>

        {/* Статус баланса */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 text-center shadow-lg border border-white/50">
          {isBalanced ? (
            <div className="text-green-600 font-medium flex items-center justify-center">
              <ScaleIcon className="w-5 h-5 mr-2" />
              Дзен достигнут! Баланс в гармонии
              <ScaleIcon className="w-5 h-5 ml-2" />
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-gray-700 font-medium">
                {Math.abs(egorBalance) > Math.abs(syomaBalance) ? (
                  <>
                    <span className="text-blue-600">Егор переплатил</span> на {utils.formatCurrency(Math.abs(egorBalance))}
                    {waterTilt > 1 && <span className="text-blue-500 ml-2">→ вода наклонилась</span>}
                  </>
                ) : Math.abs(syomaBalance) > Math.abs(egorBalance) ? (
                  <>
                    <span className="text-pink-600">Сёма переплатила</span> на {utils.formatCurrency(Math.abs(syomaBalance))}
                    {waterTilt < -1 && <span className="text-pink-500 ml-2">← вода наклонилась</span>}
                  </>
                ) : (
                  <>Баланс выровнен</>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {egorBalance < 0 && `Егор должен ${utils.formatCurrency(Math.abs(egorBalance))}`}
                {syomaBalance < 0 && `Сёма должна ${utils.formatCurrency(Math.abs(syomaBalance))}`}
                {egorBalance < 0 && syomaBalance < 0 && ' • '}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 