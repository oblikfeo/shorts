import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Plus, Trash2, BookOpen, Target, Users, Goal, Wrench, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import './App.css';

function App() {
  const [topics, setTopics] = useState('');
  const [essays, setEssays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [expandedCards, setExpandedCards] = useState(new Set());

  // Загружаем существующие рефераты при загрузке приложения
  useEffect(() => {
    loadEssays();
  }, []);

  const loadEssays = async () => {
    try {
      const response = await axios.get('/api/essays');
      setEssays(response.data);
    } catch (error) {
      console.error('Ошибка при загрузке рефератов:', error);
      setError('Не удалось загрузить рефераты');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!topics.trim()) {
      setError('Введите темы рефератов');
      return;
    }

    const topicsArray = topics
      .split('\n')
      .map(topic => topic.trim())
      .filter(topic => topic.length > 0);

    if (topicsArray.length === 0) {
      setError('Введите хотя бы одну тему');
      return;
    }

    setLoading(true);
    setError('');
    setProgress({ current: 0, total: topicsArray.length });

    // Абсолютный адрес для SSE (если фронт и бек на разных портах)
    const eventSource = new EventSource('http://localhost:5000/api/progress');

    eventSource.onopen = () => {
      console.log('SSE соединение открыто');
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('SSE событие:', data);
        
        switch (data.type) {
          case 'connected':
            console.log('SSE соединение установлено');
            break;
          case 'progress':
            setProgress({ current: data.current, total: data.total });
            break;
          case 'essay_completed':
            setProgress({ current: data.current, total: data.total });
            setEssays(prevEssays => [data.essay, ...prevEssays]);
            break;
          case 'essay_error':
            setProgress({ current: data.current, total: data.total });
            console.error(`Ошибка при обработке темы "${data.topic}":`, data.error);
            break;
        }
        // Закрываем SSE только когда всё завершено
        if (data.current === data.total && data.total > 0) {
          eventSource.close();
          console.log('SSE соединение закрыто (все темы обработаны)');
        }
      } catch (error) {
        console.error('Ошибка парсинга SSE данных:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE ошибка:', error);
      eventSource.close();
    };

    try {
      await axios.post('/api/generate-essays', {
        topics: topicsArray
      });
      
      setTopics('');
      setProgress({ current: 0, total: 0 });
    } catch (error) {
      console.error('Ошибка при генерации рефератов:', error);
      setError(error.response?.data?.error || 'Произошла ошибка при генерации рефератов');
      eventSource.close();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEssay = async (id) => {
    try {
      await axios.delete(`/api/essays/${id}`);
      setEssays(essays.filter(essay => essay.id !== id));
    } catch (error) {
      console.error('Ошибка при удалении реферата:', error);
      setError('Не удалось удалить реферат');
    }
  };

  const toggleCardExpansion = (id) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCards(newExpanded);
  };

  const filteredEssays = essays.filter(essay => 
    (essay.topic && essay.topic.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (essay.summary && essay.summary.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (essay.product && essay.product.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (essay.problem && essay.problem.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <h1>
            <BookOpen className="header-icon" />
            Генератор краткого содержания рефератов
          </h1>
          <p>Введите темы рефератов для генерации краткого содержания</p>
        </header>

        <div className="main-content">
          <div className="input-section">
            <form onSubmit={handleSubmit} className="topic-form">
              <div className="form-group">
                <label htmlFor="topics">
                  <Plus className="icon" />
                  Темы рефератов (по одной на строку)
                </label>
                <textarea
                  id="topics"
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder="Например:&#10;Искусственный интеллект в медицине&#10;Экологические проблемы современности&#10;Развитие электронной коммерции"
                  rows={8}
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="error-message">
                  <AlertCircle className="icon" />
                  {error}
                </div>
              )}

              <button 
                type="submit" 
                className="submit-btn"
                disabled={loading || !topics.trim()}
              >
                {loading ? 'Генерация...' : 'Сгенерировать рефераты'}
              </button>
            </form>

            {loading && (
              <div className="progress-section">
                <div className="loading-spinner"></div>
                <p>Обработано: {progress.current} из {progress.total}</p>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          <div className="search-section">
            <div className="search-box">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Поиск по темам, продуктам или проблемам..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            <p className="results-count">
              Найдено рефератов: {filteredEssays.length}
            </p>
          </div>

          <div className="essays-grid">
            {filteredEssays.map((essay) => (
              <div key={essay.id} className="essay-card fade-in">
                <div className="card-header">
                  <h3 className="essay-topic">{essay.topic}</h3>
                  {essay.category && (
                    <div className="essay-category">
                      <span>Категория: <b>{essay.category}</b></span>
                    </div>
                  )}
                  <div className="card-actions">
                    <button
                      onClick={() => toggleCardExpansion(essay.id)}
                      className="expand-btn"
                      title={expandedCards.has(essay.id) ? "Свернуть" : "Развернуть"}
                    >
                      {expandedCards.has(essay.id) ? <ChevronUp className="icon" /> : <ChevronDown className="icon" />}
                    </button>
                    <button
                      onClick={() => handleDeleteEssay(essay.id)}
                      className="delete-btn"
                      title="Удалить реферат"
                    >
                      <Trash2 className="icon" />
                    </button>
                  </div>
                </div>

                {essay.error ? (
                  <div className="error-content">
                    <AlertCircle className="icon" />
                    <p>Ошибка: {essay.error}</p>
                  </div>
                ) : (
                  <>
                    <div className="essay-summary">
                      <p>{essay.summary}</p>
                    </div>
                    
                    <div className={`essay-details ${expandedCards.has(essay.id) ? 'expanded' : 'collapsed'}`}>
                      <div className="detail-item">
                        <div className="item-header">
                          <Target className="icon" />
                          <strong>Продукт:</strong>
                        </div>
                        <p>{essay.product}</p>
                      </div>

                      <div className="detail-item">
                        <div className="item-header">
                          <AlertCircle className="icon" />
                          <strong>Проблема:</strong>
                        </div>
                        <p>{essay.problem}</p>
                      </div>

                      <div className="detail-item">
                        <div className="item-header">
                          <BookOpen className="icon" />
                          <strong>Актуальность:</strong>
                        </div>
                        <p>{essay.relevance}</p>
                      </div>

                      <div className="detail-item">
                        <div className="item-header">
                          <Goal className="icon" />
                          <strong>Цель:</strong>
                        </div>
                        <p>{essay.goal}</p>
                      </div>

                      <div className="detail-item">
                        <div className="item-header">
                          <Wrench className="icon" />
                          <strong>Ресурсы:</strong>
                        </div>
                        <p>{essay.resources}</p>
                      </div>

                      <div className="detail-item">
                        <div className="item-header">
                          <Users className="icon" />
                          <strong>Роли:</strong>
                        </div>
                        <p>{essay.roles}</p>
                      </div>

                      <div className="detail-item">
                        <div className="item-header">
                          <Target className="icon" />
                          <strong>Целевая аудитория:</strong>
                        </div>
                        <p>{essay.target_audience}</p>
                      </div>
                    </div>
                  </>
                )}
                <div className="card-footer">
                  <small>
                    Создан: {new Date(essay.createdAt).toLocaleString('ru-RU')}
                  </small>
                </div>
              </div>
                          ))}
            </div>

          {filteredEssays.length === 0 && !loading && (
            <div className="empty-state">
              <BookOpen className="empty-icon" />
              <h3>Рефераты не найдены</h3>
              <p>
                {searchTerm 
                  ? 'Попробуйте изменить поисковый запрос' 
                  : 'Добавьте темы рефератов для генерации краткого содержания'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App; 