// src/components/Chatbot.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import '../styles/Chatbot.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Model {
  id: string;
  name: string;
  description: string;
}

const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('mistral-small');
  const [models, setModels] = useState<Model[]>([]);
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { instance, accounts } = useMsal();

  // Event Listener für "Get Started" Button
  useEffect(() => {
    const handleOpenChatbot = () => {
      setIsOpen(true);
    };

    window.addEventListener('openChatbot', handleOpenChatbot);
    
    return () => {
      window.removeEventListener('openChatbot', handleOpenChatbot);
    };
  }, []);

  // Token holen (stabil via useCallback)
  const getAccessToken = useCallback(async (): Promise<string> => {
    try {
      const account = accounts[0];
      if (!account) {
        console.log('No account found, using anonymous mode');
        return '';
      }

      const response = await instance.acquireTokenSilent({
        scopes: ['User.Read'],
        account
      });

      return response.accessToken;
    } catch (error) {
      console.error('Token acquisition failed:', error);
      return '';
    }
  }, [instance, accounts]);

  // Modelle laden (stabil via useCallback)
  const fetchModels = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const response = await fetch('http://localhost:3001/api/models', { headers });

      if (response.ok) {
        const data = await response.json();
        setModels(data.models);
      } else {
        throw new Error('Failed to fetch models');
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
      // Fallback-Modelle
      setModels([
        { id: 'mistral-small', name: 'Mistral Small', description: 'Fast, cost-effective' },
        { id: 'mistral-medium', name: 'Mistral Medium', description: 'Balanced' },
        { id: 'mistral-large', name: 'Mistral Large', description: 'Best quality' }
      ]);
    }
  }, [getAccessToken]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const token = await getAccessToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: inputMessage,
          model: selectedModel,
          useKnowledgeBase
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  // Effects
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <>
      {/* Chat Button */}
      <button
        className="chatbot-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle chat"
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-container">
          <div className="chatbot-header">
            <h3>AI Assistant</h3>
            <div className="chatbot-controls">
              <button onClick={clearChat} className="clear-button">Clear</button>
              <button onClick={() => setIsOpen(false)} className="close-button">✕</button>
            </div>
          </div>

          {/* Model Selection */}
          <div className="chatbot-settings">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="model-select"
            >
              {models.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>

            <label className="kb-toggle">
              <input
                type="checkbox"
                checked={useKnowledgeBase}
                onChange={(e) => setUseKnowledgeBase(e.target.checked)}
              />
              Use Knowledge Base
            </label>
          </div>

          {/* Messages */}
          <div className="chatbot-messages">
            {messages.length === 0 ? (
              <div className="welcome-message">
                <p>Hello! I'm your AI assistant. I can help you with:</p>
                <ul>
                  <li>Questions about our services and products</li>
                  <li>Information from our knowledge base</li>
                  <li>General inquiries about the company</li>
                </ul>
                <p>How can I help you today?</p>
              </div>
            ) : (
              messages.map(message => (
                <div
                  key={message.id}
                  className={`message ${message.role}`}
                >
                  <div className="message-content">
                    {message.content}
                  </div>
                  <div className="message-time">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="message assistant">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="chatbot-input">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isLoading}
              rows={1}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !inputMessage.trim()}
              className="send-button"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;