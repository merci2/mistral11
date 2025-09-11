// src/components/Chatbot.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import '../styles/Chatbot.css';
import { useAuth } from '../config/useAuth';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[]; // Quellen aus Knowledge Base
  navigationTarget?: string; // NEU: Ziel für Navigation
}

interface Model {
  id: string;
  name: string;
  description: string;
}

interface KnowledgeBaseFile {
  id: string;
  name: string;
  uploadDate: Date;
}

const Chatbot: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { account } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('mistral-small');
  const [models, setModels] = useState<Model[]>([]);
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(true);
  
  // Upload-States
  const [showUpload, setShowUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  
  // Knowledge Base Viewer
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [knowledgeBaseFiles, setKnowledgeBaseFiles] = useState<KnowledgeBaseFile[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { instance, accounts } = useMsal();

  // NEU: Navigation-Keywords Mapping
  const navigationKeywords = {
    '/contact': ['kontakt', 'contact', 'kontaktformular', 'contact form', 'anfrage', 'nachricht senden', 'message', 'erreichen', 'email', 'telefon', 'phone'],
    '/services': ['service', 'dienstleistung', 'web development', 'mobile app', 'consulting', 'beratung', 'entwicklung'],
    '/products': ['produkt', 'product', 'product a', 'product b', 'enterprise', 'smb', 'lösung', 'solution'],
    '/about': ['über uns', 'about', 'unternehmen', 'company', 'wer sind', 'who are', 'team', 'geschichte'],
    '/blog': ['blog', 'artikel', 'article', 'news', 'updates', 'neuigkeiten', 'beitrag'],
    '/faq': ['faq', 'häufig', 'frequently', 'frage', 'question', 'hilfe', 'help', 'support'],
    '/': ['home', 'startseite', 'hauptseite', 'main page', 'homepage', 'start']
  };

  // NEU: Funktion zur Erkennung der Zielseite
  const detectNavigationTarget = (text: string): string | null => {
    const lowerText = text.toLowerCase();
    
    for (const [path, keywords] of Object.entries(navigationKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return path;
      }
    }
    return null;
  };

  // NEU: Auto-Navigation bei Assistant-Antworten
  const handleNavigation = (target: string) => {
    if (location.pathname !== target) {
      navigate(target);
      
      // Visuelles Feedback
      const messageDiv = document.createElement('div');
      messageDiv.className = 'navigation-notice';
      messageDiv.textContent = `📍 Navigiere zu: ${getPageName(target)}`;
      
      const chatMessages = document.querySelector('.chatbot-messages');
      if (chatMessages) {
        chatMessages.appendChild(messageDiv);
        setTimeout(() => messageDiv.remove(), 3000);
      }
    }
  };

  // NEU: Seitennamen-Mapping
  const getPageName = (path: string): string => {
    const pageNames: { [key: string]: string } = {
      '/': 'Home',
      '/contact': 'Contact',
      '/services': 'Services',
      '/products': 'Products',
      '/about': 'About Us',
      '/blog': 'Blog',
      '/faq': 'FAQ'
    };
    return pageNames[path] || 'Page';
  };

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

  // Knowledge Base Files laden
  const fetchKnowledgeBaseFiles = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const response = await fetch('http://localhost:3001/api/admin/files', { headers });

      if (response.ok) {
        const data = await response.json();
        setKnowledgeBaseFiles(data.files || []);
      }
    } catch (error) {
      console.error('Failed to fetch knowledge base files:', error);
    }
  }, [getAccessToken]);

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

  // Delete file from Knowledge Base
  const deleteKnowledgeBaseFile = async (fileId: string, fileName: string) => {
    if (!confirm(`Delete "${fileName}" from knowledge base?`)) return;
    
    try {
      const token = await getAccessToken();
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const response = await fetch(`http://localhost:3001/api/admin/files/${fileId}`, {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        await fetchKnowledgeBaseFiles();
        
        // Info message
        const infoMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Document "${fileName}" was removed from the knowledge base.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, infoMessage]);
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  // File Upload Handler - erweitert für verschiedene Dateitypen
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Erweiterte Validierung
    const allowedExtensions = ['.pdf', '.txt', '.docx', '.md'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      alert(`Please select a valid file type: ${allowedExtensions.join(', ')}`);
      return;
    }
    
    // Validiere Dateigröße (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }
    
    setUploadStatus('uploading');
    setUploadProgress(0);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const token = await getAccessToken();
      const headers: HeadersInit = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const xhr = new XMLHttpRequest();
      
      // Progress tracking
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      });
      
      // Handle completion
      xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
          setUploadStatus('success');
          
          const response = JSON.parse(xhr.responseText);
          
          // Zeige Erfolgsmeldung
          const successMessage: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: `Document "${file.name}" was successfully uploaded. ${response.chunks ? `Created ${response.chunks} searchable chunks.` : ''} You can now ask questions about it!`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, successMessage]);
          
          // Refresh KB files list
          await fetchKnowledgeBaseFiles();
          
          // Reset nach 3 Sekunden
          setTimeout(() => {
            setUploadStatus('idle');
            setUploadProgress(0);
            setShowUpload(false);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          }, 3000);
        } else {
          const errorResponse = JSON.parse(xhr.responseText);
          throw new Error(errorResponse.error || 'Upload failed');
        }
      });
      
      xhr.addEventListener('error', () => {
        throw new Error('Network error');
      });
      
      // Sende Request
      xhr.open('POST', 'http://localhost:3001/api/admin/upload');
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value as string);
      });
      xhr.send(formData);
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Failed to upload: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      setTimeout(() => {
        setUploadStatus('idle');
        setUploadProgress(0);
      }, 3000);
    }
  };

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
    const currentMessage = inputMessage;
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
          message: currentMessage,
          model: selectedModel,
          useKnowledgeBase
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      // NEU: Erkennung des Navigationsziels
      const navigationTarget = detectNavigationTarget(data.response);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        sources: data.sources,
        navigationTarget: navigationTarget || undefined // NEU: Navigation Target hinzufügen
      };

      setMessages(prev => [...prev, assistantMessage]);

      // NEU: Automatische Navigation wenn Ziel erkannt wurde
      if (navigationTarget) {
        setTimeout(() => {
          handleNavigation(navigationTarget);
        }, 500); // Kurze Verzögerung für bessere UX
      }
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
    fetchKnowledgeBaseFiles();
  }, [fetchModels, fetchKnowledgeBaseFiles]);

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
        {isOpen ? '×' : 'Chat'}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-container">
          <div className="chatbot-header">
            <h3>AI Assistant</h3>
            <div className="chatbot-controls">
              <button onClick={clearChat} className="clear-button">Clear</button>
              <button onClick={() => setIsOpen(false)} className="close-button">×</button>
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
              Use KB
            </label>
            
            <button
              className="upload-kb-button"
              onClick={() => setShowUpload(!showUpload)}
              title="Upload to Knowledge Base"
            >
              Upload
            </button>
            
            {/* Knowledge Base Button */}
            <button
              className="kb-view-button"
              onClick={() => setShowKnowledgeBase(!showKnowledgeBase)}
              title="View Knowledge Base"
            >
              KB ({knowledgeBaseFiles.length})
            </button>
          </div>

          {/* Knowledge Base Viewer */}
          {showKnowledgeBase && (
            <div className="kb-viewer">
              <div className="kb-viewer-header">
                <h4>Knowledge Base Documents</h4>
                <button onClick={() => setShowKnowledgeBase(false)}>×</button>
              </div>
              <div className="kb-files-list">
                {knowledgeBaseFiles.length === 0 ? (
                  <p className="kb-empty">No documents uploaded yet</p>
                ) : (
                  knowledgeBaseFiles.map(file => (
                    <div key={file.id} className="kb-file-item">
                      <span className="kb-file-name">{file.name}</span>
                      <button 
                        className="kb-file-delete"
                        onClick={() => deleteKnowledgeBaseFile(file.id, file.name)}
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Upload Section - erweitert */}
          {showUpload && (
            <div className="upload-section">
              <div className="upload-container">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.txt,.docx,.md"
                  style={{ display: 'none' }}
                />
                
                {uploadStatus === 'idle' && (
                  <div className="upload-prompt">
                    <p>Upload a document to the knowledge base</p>
                    <button
                      className="upload-button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Choose File (PDF, TXT, DOCX, MD)
                    </button>
                    <p className="upload-hint">Max file size: 10MB</p>
                  </div>
                )}
                
                {uploadStatus === 'uploading' && (
                  <div className="upload-progress">
                    <p>Processing document...</p>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p>{Math.round(uploadProgress)}%</p>
                  </div>
                )}
                
                {uploadStatus === 'success' && (
                  <div className="upload-success">
                    <p>Upload successful!</p>
                  </div>
                )}
                
                {uploadStatus === 'error' && (
                  <div className="upload-error">
                    <p>Upload failed. Please try again.</p>
                  </div>
                )}
              </div>
              
              <button 
                className="upload-close"
                onClick={() => setShowUpload(false)}
              >
                ×
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="chatbot-messages">
            {messages.length === 0 ? (
              <div className="welcome-message">
                <p>Hello {account.name}! What's your question?</p>
                <p>You can ask me questions about this website, including documents in its knowledge base.</p>
                <p className="navigation-hint">💡 I can also navigate you to the relevant pages!</p>
              </div>
            ) : (
              messages.map(message => (
                <div
                  key={message.id}
                  className={`message ${message.role}`}
                >
                  <div className="message-content">
                    {message.content}
                    {/* NEU: Navigation Indicator */}
                    {message.navigationTarget && (
                      <div className="navigation-indicator">
                        📍 {getPageName(message.navigationTarget)}
                      </div>
                    )}
                    {/* Quellen anzeigen */}
                    {message.sources && message.sources.length > 0 && (
                      <div className="message-sources">
                        <span className="source-label">Source:</span>
                        {message.sources.map((source, idx) => (
                          <span key={idx} className="source-item">{source}</span>
                        ))}
                      </div>
                    )}
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