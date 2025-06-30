import Anthropic from '@anthropic-ai/sdk';

// Функция для получения Claude клиента (ленивая инициализация)
function getAnthropicClient() {
  const apiKey = process.env.CLAUDE_API_KEY;
  console.log('🔑 Claude API Key статус:', apiKey ? `Есть (длина: ${apiKey.length})` : 'НЕТ');

  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY не найден в переменных окружения!');
  }

  return new Anthropic({
    apiKey: apiKey,
  });
}

// Интерфейсы для типизации
interface Item {
  id: number;
  name: string;
  qty: number;
  price: number;
}

interface Category {
  id: number;
  name: string;
  description: string;
}

interface ClassificationResult {
  [itemId: number]: number; // itemId -> categoryId
}

/**
 * Классифицирует товары по категориям с помощью Claude AI
 * @param items - массив товаров для классификации
 * @param categories - доступные категории
 * @returns объект с соответствием itemId -> categoryId
 */
export async function classifyItems(
  items: Item[], 
  categories: Category[]
): Promise<ClassificationResult> {
  try {
    console.log(`🤖 Начинаю AI классификацию ${items.length} товаров...`);
    console.log(`📋 Товары для классификации:`, items.map(i => i.name).join(', '));
    console.log(`🏷️ Доступные категории:`, categories.map(c => c.name).join(', '));

    // Подготавливаем данные для промпта
    const categoriesText = categories.map(cat => 
      `- "${cat.name}" (ID: ${cat.id}): ${cat.description}`
    ).join('\n');

    const itemsText = items.map(item => 
      `"${item.name}" (ID: ${item.id})`
    ).join('\n');
    
    console.log(`📝 Отправляю запрос к Claude API...`);

    const prompt = `Ты эксперт по анализу и классификации товаров из чеков магазинов. 

ТВОЯ ЗАДАЧА: Классифицируй каждый товар по подходящей категории, ВНИМАТЕЛЬНО читая названия и описания категорий.

ДОСТУПНЫЕ КАТЕГОРИИ (читай ВНИМАТЕЛЬНО названия и описания):
${categoriesText}

ТОВАРЫ ДЛЯ КЛАССИФИКАЦИИ:
${itemsText}

ПРАВИЛА КЛАССИФИКАЦИИ:

1. ВНИМАТЕЛЬНО читай название каждой категории и её описание
2. Анализируй название товара по ключевым словам: НАПРИМЕР
   - Овощи, фрукты: лук, огурцы, помидоры, яблоки, бананы, картофель, морковь
   - Белок: мясо, рыба, курица, говядина, свинина, фарш, яйца, колбаса
   - Молочная продукция: молоко, сыр, творог, йогурт, кефир, сметана, масло сливочное
   - Бакалея: крупы, мука, сахар, соль, макароны, рис, гречка, хлеб
   - Чай, кофе: чай (любой вид), кофе (любой вид), какао
   - Джанг-фуд: чипсы, сладости, печенье, конфеты, мармелад, снеки
   - Бытовая химия: моющие средства, пакеты, средства гигиены, туалетная бумага
   - Прочее: всё что не подходит к другим категориям

3. СТРОГО следуй названиям категорий - если категория называется "Овощи, фрукты", то туда овощи и фрукты

4. Если сомневаешься между двумя категориями - выбирай более специфичную

5. Возвращай ТОЛЬКО JSON без объяснений:

ФОРМАТ ОТВЕТА (СТРОГО):
{
  "ID_товара": ID_категории,
  "ID_товара": ID_категории
}

Пример:
{
  "1": 10,
  "2": 8
}

ВАЖНО: Отвечай ТОЛЬКО JSON объектом, без дополнительного текста!`;

    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      temperature: 0.3, // Делаем более консистентным
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    console.log(`✅ Получен ответ от Claude API`);

    // Парсим ответ от Claude
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Неожиданный тип ответа от Claude');
    }

    console.log(`🧠 Ответ Claude:`, content.text);
    
    // Извлекаем JSON из ответа (на случай если Claude добавил дополнительный текст)
    let jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Не найден JSON в ответе Claude');
    }
    
    const classification = JSON.parse(jsonMatch[0]) as ClassificationResult;
    console.log(`🔍 Распаршенная классификация:`, classification);
    
    // Валидация результата
    console.log(`🔎 Валидируем результаты классификации...`);
    const validClassification: ClassificationResult = {};
    let validCount = 0;
    let fallbackCount = 0;
    
    for (const item of items) {
      const categoryId = classification[item.id];
      const category = categories.find(cat => cat.id === categoryId);
      
      if (categoryId && category) {
        validClassification[item.id] = categoryId;
        console.log(`✅ "${item.name}" → "${category.name}"`);
        validCount++;
      } else {
        // Если AI не смог классифицировать или дал неверную категорию,
        // присваиваем категорию "Прочее" (обычно последняя)
        const miscCategory = categories.find(cat => cat.name === 'Прочее');
        const fallbackCategoryId = miscCategory?.id || categories[categories.length - 1].id;
        validClassification[item.id] = fallbackCategoryId;
        const fallbackCategory = categories.find(cat => cat.id === fallbackCategoryId);
        console.log(`⚠️ "${item.name}" → "${fallbackCategory?.name}" (fallback)`);
        fallbackCount++;
      }
    }

    console.log(`🎯 Классификация завершена: ${validCount} точных совпадений, ${fallbackCount} fallback`);
    return validClassification;

  } catch (error) {
    console.error('❌ Ошибка при классификации товаров:', error);
    console.error('🔍 Детали ошибки:', (error as Error)?.message);
    
    // В случае ошибки возвращаем пустой результат - товары останутся без категорий
    console.log('⚠️ AI классификация не удалась. Товары останутся без категорий для ручного редактирования.');
    
    // Возвращаем пустой объект - никаких категорий не присваиваем
    return {};
  }
} 