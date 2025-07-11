const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Хранилище для активных SSE соединений
const sseConnections = new Set();

// Middleware для CORS
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

const DATA_DIR = path.join(__dirname, 'data');

// Создаем папку data если её нет
async function ensureDataDirectory() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.log('Папка data уже существует');
  }
}

// Загрузить все работы из всех файлов
async function loadEssays() {
  try {
    const files = await fs.readdir(DATA_DIR);
    const essayFiles = files.filter(f => f.endsWith('.json'));
    let all = [];
    
    for (const file of essayFiles) {
      try {
        const data = await fs.readFile(path.join(DATA_DIR, file), 'utf8');
        const essay = JSON.parse(data);
        all.push(essay);
      } catch (error) {
        console.error(`Ошибка чтения файла ${file}:`, error);
      }
    }
    
    return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    console.error('Ошибка загрузки работ:', error);
    return [];
  }
}

// Сохранить один реферат в отдельный файл
async function saveEssay(essay) {
  await ensureDataDirectory();
  const fileName = `essay_${essay.id}.json`;
  await fs.writeFile(path.join(DATA_DIR, fileName), JSON.stringify(essay, null, 2));
}

// Удалить файл реферата
async function deleteEssayFile(id) {
  try {
    const fileName = `essay_${id}.json`;
    await fs.unlink(path.join(DATA_DIR, fileName));
  } catch (error) {
    console.error(`Ошибка удаления файла essay_${id}.json:`, error);
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
    
    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      
      try {
        console.log(`Обрабатываю тему ${i + 1}/${topics.length}: ${topic}`);
        
        // Отправляем прогресс
        sendProgress({
          type: 'progress',
          current: i + 1,
          total: topics.length,
          topic: topic
        });
        
        const summary = await generateEssaySummary(topic);
        
        const essay = {
          id: Date.now() + i,
          topic: topic,
          ...summary,
          createdAt: new Date().toISOString()
        };
        
        // Сохраняем каждый реферат сразу в отдельный файл
        await saveEssay(essay);
        results.push(essay);
        
        // Отправляем информацию о завершенном реферате
        sendProgress({
          type: 'essay_completed',
          current: i + 1,
          total: topics.length,
          essay: essay
        });
        
        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Ошибка при обработке темы "${topic}":`, error.message);
        const errorEssay = {
          id: Date.now() + i,
          topic: topic,
          error: error.message,
          createdAt: new Date().toISOString()
        };
        await saveEssay(errorEssay);
        results.push(errorEssay);
        
        // Отправляем информацию об ошибке
        sendProgress({
          type: 'essay_error',
          current: i + 1,
          total: topics.length,
          topic: topic,
          error: error.message
        });
      }
    }
    
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
    
    // Просто удаляем файл реферата
    await deleteEssayFile(parseInt(id));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при удалении реферата:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// SSE endpoint для отправки прогресса
app.get('/api/progress', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Отправляем начальное сообщение
  res.write('data: {"type": "connected"}\n\n');

  // Добавляем соединение в список
  sseConnections.add(res);

  // Удаляем соединение при закрытии
  req.on('close', () => {
    sseConnections.delete(res);
  });
});

// Функция для отправки прогресса всем подключенным клиентам
function sendProgress(data) {
  sseConnections.forEach(client => {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
}); 