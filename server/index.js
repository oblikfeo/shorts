const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, 'data');

// Создаем папку data если её нет
async function ensureDataDirectory() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.log('Папка data уже существует');
  }
}

// Получить список файлов с работами
async function getEssayFiles() {
  try {
    const files = await fs.readdir(DATA_DIR);
    return files.filter(f => /^essays_\d+\.json$/.test(f)).sort((a, b) => {
      const na = parseInt(a.match(/essays_(\d+)\.json/)[1]);
      const nb = parseInt(b.match(/essays_(\d+)\.json/)[1]);
      return na - nb;
    });
  } catch {
    return [];
  }
}

// Загрузить все работы из всех файлов
async function loadEssays() {
  const files = await getEssayFiles();
  let all = [];
  for (const file of files) {
    try {
      const data = await fs.readFile(path.join(DATA_DIR, file), 'utf8');
      all = all.concat(JSON.parse(data));
    } catch {}
  }
  return all;
}

// Сохранить массив работ в файл с нужным номером
async function saveEssaysToFile(essays, fileIndex) {
  const fileName = `essays_${fileIndex}.json`;
  await fs.writeFile(path.join(DATA_DIR, fileName), JSON.stringify(essays, null, 2));
}

// Сохранить новые работы по 20 в файл
async function saveEssaysChunked(newEssays) {
  await ensureDataDirectory();
  const files = await getEssayFiles();
  let all = await loadEssays();
  all = all.concat(newEssays);
  // Разбиваем на чанки по 20
  for (let i = 0; i < all.length; i += 20) {
    const chunk = all.slice(i, i + 20);
    await saveEssaysToFile(chunk, Math.floor(i / 20) + 1);
  }
}

// Генерируем краткое содержание реферата через DeepSeek API
async function generateEssaySummary(topic) {
  const categories = `Административное право, Агрохимия и агропочвоведение, Английский язык, Актерское мастерство, Автоматика и управление, Авиационная и ракетно-космическая техника, Автоматизация технологических процессов, Анализ хозяйственной деятельности, Антикризисное управление, Архитектура и строительство, Археология, Астрономия, Базы данных, Безопасность жизнедеятельности, Биотехнология, Библиотечно-информационная деятельность, Бизнес-планирование, Бухгалтерский учет и аудит, Банковское дело, Биология, Водные биоресурсы и аквакультура, Военное дело, Ветеринария, Воспроизводство и переработка лесных ресурсов, Внешнеэкономическая деятельность, Высшая математика, Геометрия, Гидравлика, Геодезия, Гостиничное дело, Государственное и муниципальное управление, Геология, География, Гражданское право, Другое, Детали машин, Документоведение и архивоведение, Деньги, Деловой этикет, Дизайн, Естествознание, Жилищное право, Железнодорожный транспорт, Журналистика, Земельное право, Испанский язык, Инженерные сети и оборудование, Инновационный менеджмент, Инвестиции, Информационная безопасность, Информационные технологии, Издательское дело, Информатика, История, Искусство, Конституционное право, Кулинария, Краеведение, Криминалистика, Конфликтология, Кредит, Культурология, Логика, Логистика, Литература, Муниципальное право, Международное право, Микропроцессорная техника, Метрология, Менеджмент организации, Металлургия, Музыка, Микро-, макроэкономика, Менеджмент, Маркетинг, Механика, Машиностроение, Материаловедение, Медицина, Международные отношения, Налоговое право, Нефтегазовое дело, Наноинженерия, Налоги, Организационное развитие, Пожарная безопасность, Природообустройство и водопользование, Приборостроение и оптотехника, Промышленный маркетинг и менеджмент, Производственный маркетинг и менеджмент, Процессы и аппараты, Программирование, Право и юриспруденция, Психология, Политология, Педагогика, Рынок ценных бумаг, Русский язык, Религия, Радиофизика, Режиссура, Работа на компьютере, Реклама и PR, Семейное право, Сопротивление материалов, Связи с общественностью, Социальная работа, Сельское и рыбное хозяйство, Стратегический менеджмент, Страхование, Статистика, Стандартизация, Страноведение, Социология, Трудовое право, Теория государства и права (ТГП), Таможенное право, Текстильная промышленность, Теория вероятностей, Теоретическая механика, Теория управления, Технология продовольственных продуктов и товаров, Технологические машины и оборудование, Теплоэнергетика и теплотехника, Туризм, Товароведение, Таможенное дело, Торговое дело, Теория машин и механизмов, Транспортные средства, Уголовный процесс, Уголовное право, Управление качеством, Управление проектами, Управление персоналом, Финансовое право, Фармация, Финансовый менеджмент, Физическая культура, Финансы, Философия, Физика, Хирургия, Химия, Ценообразование и оценка бизнеса, Черчение, Экологическое право, Эконометрика, Экономический анализ, Экономическая теория, Экономика предприятия, Энергетическое машиностроение, Экономика труда, Этика, Экономика, Электроника, электротехника, радиотехника, Экология, Ядерные физика и технологии, Ядерная энергетика и теплофизика, Языки (переводы), Языкознание и филология`;

  const prompt = `Создай краткое содержание (до 10 предложений) для реферата по теме: "${topic}".\nПиши так, как если бы это был фрагмент основной части реферата, а не аннотация или описание. Не используй фразы вроде 'в данном реферате', 'рассматривается', 'анализируется' и т.п. Текст должен быть информативным, по существу, как будто это часть готового реферата.\nОпредели, к какой из следующих категорий относится тема реферата. Используй только одну из категорий из списка ниже (категории перечислены полностью):\n${categories}\nВерни результат в формате JSON со следующими полями:\n{\n  "summary": "краткое содержание реферата (до 10 предложений, как фрагмент реферата)",\n  "category": "категория из списка",\n  "product": "описание продукта/решения",\n  "problem": "описание проблемы",\n  "relevance": "актуальность темы",\n  "goal": "цель работы",\n  "resources": "необходимые ресурсы",\n  "roles": "роли в проекте",\n  "target_audience": "целевая аудитория"\n}\nПоле summary — только содержательная часть, без вводных фраз и описаний структуры работы. Поле category — только одна категория из списка. Для остальных полей (product, problem, relevance, goal, resources, roles, target_audience) дай развернутый, но лаконичный ответ — 2-3 предложения.`;

  try {
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const content = response.data.choices[0].message.content;
    
    // Пытаемся извлечь JSON из ответа
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Если не удалось извлечь JSON, создаем структуру вручную
    return {
      summary: "Краткое содержание реферата по данной теме. Основные положения и выводы исследования.",
      product: "Продукт по теме реферата",
      problem: "Проблема, которую решает данная тема",
      relevance: "Актуальность темы в современном мире",
      goal: "Цель исследования",
      resources: "Необходимые ресурсы для реализации",
      roles: "Роли участников проекта",
      target_audience: "Целевая аудитория"
    };
  } catch (error) {
    console.error('Ошибка при обращении к DeepSeek API:', error.message);
    throw new Error('Не удалось сгенерировать содержание реферата');
  }
}

// API endpoint для генерации рефератов
app.post('/api/generate-essays', async (req, res) => {
  try {
    const { topics } = req.body;
    
    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ error: 'Необходимо предоставить массив тем' });
    }

    await ensureDataDirectory();
    const results = [];
    const batchSize = 50; // Сохраняем по 50 рефератов в файл
    
    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      
      try {
        console.log(`Обрабатываю тему ${i + 1}/${topics.length}: ${topic}`);
        
        const summary = await generateEssaySummary(topic);
        
        const essay = {
          id: Date.now() + i,
          topic: topic,
          ...summary,
          createdAt: new Date().toISOString()
        };
        
        results.push(essay);
        
        // Сохраняем каждые 50 рефератов
        if (results.length % batchSize === 0) {
          await saveEssaysChunked(results);
        }
        
        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Ошибка при обработке темы "${topic}":`, error.message);
        results.push({
          id: Date.now() + i,
          topic: topic,
          error: error.message,
          createdAt: new Date().toISOString()
        });
      }
    }
    
    // Сохраняем оставшиеся рефераты
    await saveEssaysChunked(results);
    
    res.json({
      success: true,
      processed: results.length,
      results: results
    });
    
  } catch (error) {
    console.error('Ошибка сервера:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// API endpoint для получения всех рефератов
app.get('/api/essays', async (req, res) => {
  try {
    const { search } = req.query;
    let essays = await loadEssays();
    
    // Поиск только по теме
    if (search) {
      essays = essays.filter(essay => 
        essay.topic.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    res.json(essays);
  } catch (error) {
    console.error('Ошибка при получении рефератов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// API endpoint для удаления реферата
app.delete('/api/essays/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let essays = await loadEssays();
    
    essays = essays.filter(essay => essay.id !== parseInt(id));
    await saveEssaysChunked(essays);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при удалении реферата:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
}); 