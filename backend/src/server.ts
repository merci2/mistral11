// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
// Auth middleware ist optional importiert
// import { authMiddleware, adminMiddleware } from './middleware/auth';
import { ChatService } from './services/chatService';
import { VectorStoreService } from './services/vectorStoreService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Simplified auth middleware for development
const optionalAuth = (req: any, res: any, next: any) => {
  // Skip auth in development
  req.user = {
    id: 'dev-user',
    email: 'dev@example.com',
    name: 'Developer',
    roles: ['Admin']
  };
  next();
};

// Use optionalAuth instead of real auth for now
const authMiddleware = optionalAuth;
const adminMiddleware = (req: any, res: any, next: any) => next();

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.txt', '.docx', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type') as any);
    }
  }
});

// Services
const chatService = new ChatService();
const vectorStoreService = new VectorStoreService();

// Initialize services
async function initializeServices() {
  try {
    await vectorStoreService.initialize();
    console.log('Vector store initialized');
  } catch (error) {
    console.error('Failed to initialize services:', error);
  }
}

// Routes

// Health check endpoint (no auth needed)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, model = 'mistral-small', useKnowledgeBase = true } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    let context = '';
    if (useKnowledgeBase) {
      // Retrieve relevant context from vector store
      context = await vectorStoreService.searchSimilar(message);
    }
    
    const response = await chatService.chat(message, context, model);
    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

// Admin: Upload files to knowledge base
app.post('/api/admin/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Process and add to vector store
    await vectorStoreService.addDocument(req.file.path, req.file.originalname);
    
    res.json({ 
      message: 'File uploaded and processed successfully',
      filename: req.file.originalname 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

// Admin: List knowledge base files
app.get('/api/admin/files', async (req, res) => {
  try {
    const files = await vectorStoreService.listDocuments();
    res.json({ files });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Admin: Delete file from knowledge base
app.delete('/api/admin/files/:id', async (req, res) => {
  try {
    await vectorStoreService.deleteDocument(req.params.id);
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Get available models (no auth for testing)
app.get('/api/models', (req, res) => {
  res.json({
    models: [
      { id: 'mistral-small', name: 'Mistral Small', description: 'Fast, cost-effective for simple tasks' },
      { id: 'mistral-medium', name: 'Mistral Medium', description: 'Balanced performance and cost' },
      { id: 'mistral-large', name: 'Mistral Large', description: 'Best quality for complex tasks' }
    ]
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Test the API at: http://localhost:${PORT}/api/health`);
  console.log(`Models endpoint: http://localhost:${PORT}/api/models`);
  await initializeServices();
});