// backend/src/server.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ChatService } from './services/chatService';
import { VectorStoreService } from './services/vectorStoreService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Typdefinition für Request mit File
interface RequestWithFile extends Request {
  file?: Express.Multer.File;
}

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
    // Sichere Dateinamen generieren
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, uniqueSuffix + '-' + safeFileName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.txt', '.docx', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    // Zusätzliche MIME-Type Validierung für PDFs
    if (ext === '.pdf' && file.mimetype !== 'application/pdf') {
      cb(new Error('Invalid PDF file') as any);
      return;
    }
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`) as any);
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
    
    // Zeige Statistiken beim Start
    const stats = vectorStoreService.getStats();
    console.log(`Knowledge base: ${stats.totalDocuments} documents, ${stats.totalChunks} chunks`);
  } catch (error) {
    console.error('Failed to initialize services:', error);
  }
}

// Routes

// Health check endpoint (no auth needed)
app.get('/api/health', (req: Request, res: Response) => {
  const stats = vectorStoreService.getStats();
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    knowledgeBase: {
      documents: stats.totalDocuments,
      chunks: stats.totalChunks
    }
  });
});

// Chat endpoint - AKTUALISIERT für sources support
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, model = 'mistral-small', useKnowledgeBase = true } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    let context = '';
    if (useKnowledgeBase) {
      // Retrieve relevant context from vector store
      context = await vectorStoreService.searchSimilar(message);
      
      if (context) {
        console.log(`Found relevant context for query: "${message.substring(0, 50)}..."`);
      }
    }
    
    // ChatService gibt jetzt ein Objekt mit response und sources zurück
    const result = await chatService.chat(message, context, model);
    res.json(result); // Sendet { response: string, sources?: string[] }
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

// Admin: Upload files to knowledge base
app.post('/api/admin/upload', upload.single('file'), async (req: RequestWithFile, res: Response) => {
  try {
    const uploadedFile = req.file;
    
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log(`Processing upload: ${uploadedFile.originalname} (${uploadedFile.size} bytes)`);
    
    // Spezieller Hinweis für PDF-Dateien
    const ext = path.extname(uploadedFile.originalname).toLowerCase();
    if (ext === '.pdf') {
      // Prüfe ob pdf-parse installiert ist
      try {
        require.resolve('pdf-parse');
      } catch (e) {
        return res.status(500).json({ 
          error: 'PDF support not installed. Please run: npm install pdf-parse' 
        });
      }
    }
    
    // Process and add to vector store
    await vectorStoreService.addDocument(uploadedFile.path, uploadedFile.originalname);
    
    // Get updated stats
    const stats = vectorStoreService.getStats();
    const docStats = stats.documents.find(d => d.name === uploadedFile.originalname);
    
    res.json({ 
      message: 'File uploaded and processed successfully',
      filename: uploadedFile.originalname,
      chunks: docStats?.chunks || 0,
      totalDocuments: stats.totalDocuments
    });
  } catch (error) {
    console.error('Upload error:', error);
    
    // Cleanup bei Fehler
    const uploadedFile = req.file;
    if (uploadedFile && uploadedFile.path) {
      try {
        fs.unlinkSync(uploadedFile.path);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    // Bessere Fehlermeldungen
    let errorMessage = 'Failed to process file';
    if (error instanceof Error) {
      if (error.message.includes('pdf-parse')) {
        errorMessage = 'PDF processing failed. Make sure pdf-parse is installed.';
      } else if (error.message.includes('No text content')) {
        errorMessage = 'Could not extract text from PDF. The file might be corrupted or contain only images.';
      } else {
        errorMessage = error.message;
      }
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// Admin: List knowledge base files
app.get('/api/admin/files', async (req: Request, res: Response) => {
  try {
    const files = await vectorStoreService.listDocuments();
    const stats = vectorStoreService.getStats();
    
    res.json({ 
      files,
      stats: {
        totalDocuments: stats.totalDocuments,
        totalChunks: stats.totalChunks
      }
    });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Admin: Delete file from knowledge base
app.delete('/api/admin/files/:id', async (req: Request, res: Response) => {
  try {
    await vectorStoreService.deleteDocument(req.params.id);
    
    const stats = vectorStoreService.getStats();
    
    res.json({ 
      message: 'File deleted successfully',
      remainingDocuments: stats.totalDocuments
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Admin: Get knowledge base statistics
app.get('/api/admin/stats', async (req: Request, res: Response) => {
  try {
    const stats = vectorStoreService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Get available models (no auth for testing)
app.get('/api/models', (req: Request, res: Response) => {
  res.json({
    models: [
      { id: 'mistral-small', name: 'Mistral Small', description: 'Fast, cost-effective for simple tasks' },
      { id: 'mistral-medium', name: 'Mistral Medium', description: 'Balanced performance and cost' },
      { id: 'mistral-large', name: 'Mistral Large', description: 'Best quality for complex tasks' }
    ]
  });
});

// Error handling middleware
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: `Upload error: ${error.message}` });
  }
  
  if (error.message && error.message.includes('Invalid file type')) {
    return res.status(400).json({ error: error.message });
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Für Vercel: Nur in lokaler Entwicklung den Server starten
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, async () => {
    console.log(`\nServer running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Chat endpoint: http://localhost:${PORT}/api/chat`);
    console.log(`Upload endpoint: http://localhost:${PORT}/api/admin/upload`);
    console.log(`Stats endpoint: http://localhost:${PORT}/api/admin/stats\n`);
    
    await initializeServices();
  });
}

// Services initialisieren auch für Vercel
initializeServices();

// Export app als default für Vercel
export default app;