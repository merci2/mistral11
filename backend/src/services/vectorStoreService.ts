// backend/src/services/vectorStoreService.ts
import fs from 'fs/promises';
import path from 'path';

interface DocumentChunk {
  id: string;
  text: string;
  source: string;
  uploadDate: string;
  embedding?: number[];
}

// Typ für die Mistral Embedding Response
interface MistralEmbeddingResponse {
  data: {
    embedding: number[];
  }[];
}

export class VectorStoreService {
  private documents: Map<string, { name: string, uploadDate: Date }> = new Map();
  private chunks: DocumentChunk[] = [];
  private mistralApiKey: string;

  constructor() {
    this.mistralApiKey = process.env.MISTRAL_API_KEY || '';
  }

  async initialize() {
    console.log('Vector store initialized (in-memory mode)');
    // Keine externe Initialisierung nötig für In-Memory Store
  }

  // Mistral API direkt aufrufen für Embeddings
  private async getEmbedding(text: string): Promise<number[]> {
    if (!this.mistralApiKey) {
      return this.simpleEmbedding(text);
    }

    try {
      const response = await fetch('https://api.mistral.ai/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.mistralApiKey}`
        },
        body: JSON.stringify({
          model: 'mistral-embed',
          input: [text]
        })
      });

      if (!response.ok) {
        throw new Error(`Mistral API error: ${response.statusText}`);
      }

      // Zuerst das rohe JSON lesen (unknown), dann casten und validieren
      const raw = await response.json();
      const data = raw as MistralEmbeddingResponse;

      // Sicherheitschecks: existierende Felder & Typen prüfen
      if (
        !data ||
        !Array.isArray(data.data) ||
        data.data.length === 0 ||
        !Array.isArray(data.data[0].embedding)
      ) {
        console.error('Unexpected embedding response from Mistral API:', raw);
        return this.simpleEmbedding(text);
      }

      return data.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      return this.simpleEmbedding(text);
    }
  }

  // Einfache Fallback-"Embedding" Funktion
  private simpleEmbedding(text: string): number[] {
    const vector = new Array(1024).fill(0);
    const words = text.toLowerCase().split(/\s+/);

    words.forEach((word, index) => {
      if (index < 1024) {
        let hash = 0;
        for (let i = 0; i < word.length; i++) {
          hash = ((hash << 5) - hash) + word.charCodeAt(i);
          hash = hash & hash; // Convert to 32bit integer
        }
        vector[index % 1024] = Math.abs(hash % 100) / 100;
      }
    });

    return vector;
  }

  // Kosinusähnlichkeit berechnen
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length || vec1.length === 0) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  // Verbesserte Text-Chunking Funktion für PDFs
  private splitText(text: string, chunkSize: number = 1000, overlap: number = 100): string[] {
    const chunks: string[] = [];
    
    // Entferne mehrfache Leerzeichen und Zeilenumbrüche
    const cleanedText = text.replace(/\s+/g, ' ').trim();
    
    // Versuche nach Sätzen zu splitten
    const sentences = cleanedText.match(/[^.!?]+[.!?]+/g) || [cleanedText];
    
    let currentChunk = '';
    let lastSentences: string[] = [];

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      if ((currentChunk + ' ' + trimmedSentence).length > chunkSize && currentChunk.length > 0) {
        // Füge den aktuellen Chunk hinzu
        chunks.push(currentChunk.trim());
        
        // Starte neuen Chunk mit Overlap (letzte 1-2 Sätze vom vorherigen Chunk)
        if (overlap > 0 && lastSentences.length > 0) {
          const overlapText = lastSentences.slice(-2).join(' ');
          currentChunk = overlapText + ' ' + trimmedSentence;
        } else {
          currentChunk = trimmedSentence;
        }
        
        lastSentences = [trimmedSentence];
      } else {
        currentChunk = currentChunk ? currentChunk + ' ' + trimmedSentence : trimmedSentence;
        lastSentences.push(trimmedSentence);
        
        // Behalte nur die letzten 3 Sätze für möglichen Overlap
        if (lastSentences.length > 3) {
          lastSentences.shift();
        }
      }
    }

    // Füge den letzten Chunk hinzu
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  // Spezielle Methode für PDF-Verarbeitung
  async processAndAddPDF(filePath: string, originalName: string): Promise<void> {
    try {
      console.log(`Processing PDF: ${originalName}`);
      
      // PDF-Inhalt extrahieren
      const content = await this.parseFile(filePath);
      
      if (!content || content.trim().length === 0) {
        throw new Error('No text content extracted from PDF');
      }
      
      console.log(`Extracted ${content.length} characters from PDF`);
      
      // Text in Chunks aufteilen mit Overlap für besseren Kontext
      const textChunks = this.splitText(content, 1000, 100);
      const uploadDate = new Date().toISOString();
      
      console.log(`Split into ${textChunks.length} chunks`);
      
      // Chunks mit Embeddings speichern
      for (let i = 0; i < textChunks.length; i++) {
        const chunkText = textChunks[i];
        
        // Skip sehr kurze Chunks
        if (chunkText.length < 50) continue;
        
        const embedding = await this.getEmbedding(chunkText);

        const chunk: DocumentChunk = {
          id: `${originalName}_chunk_${i}_${Date.now()}`,
          text: chunkText,
          source: originalName,
          uploadDate: uploadDate,
          embedding: embedding
        };

        this.chunks.push(chunk);
      }

      // Dokument registrieren
      const docId = this.generateDocId(originalName);
      this.documents.set(docId, {
        name: originalName,
        uploadDate: new Date()
      });

      // Cleanup: Temporäre Datei löschen
      await fs.unlink(filePath);

      console.log(`PDF ${originalName} successfully added: ${textChunks.length} chunks created`);
    } catch (error) {
      console.error('Error processing PDF:', error);
      // Cleanup bei Fehler
      try {
        await fs.unlink(filePath);
      } catch (e) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  // Hauptmethode zum Hinzufügen von Dokumenten (ruft processAndAddPDF für PDFs auf)
  async addDocument(filePath: string, originalName: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    
    // Verwende spezielle PDF-Verarbeitung für PDF-Dateien
    if (ext === '.pdf') {
      return this.processAndAddPDF(filePath, originalName);
    }
    
    // Standard-Verarbeitung für andere Dateitypen
    try {
      const content = await this.parseFile(filePath);

      const textChunks = this.splitText(content);
      const uploadDate = new Date().toISOString();

      for (let i = 0; i < textChunks.length; i++) {
        const chunkText = textChunks[i];
        const embedding = await this.getEmbedding(chunkText);

        const chunk: DocumentChunk = {
          id: `${originalName}_${i}_${Date.now()}`,
          text: chunkText,
          source: originalName,
          uploadDate: uploadDate,
          embedding: embedding
        };

        this.chunks.push(chunk);
      }

      const docId = this.generateDocId(originalName);
      this.documents.set(docId, {
        name: originalName,
        uploadDate: new Date()
      });

      await fs.unlink(filePath);

      console.log(`Document ${originalName} added: ${textChunks.length} chunks`);
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    }
  }

  // Verbesserte Suche mit mehr Kontext
  async searchSimilar(query: string, topK: number = 5): Promise<string> {
    try {
      if (this.chunks.length === 0) {
        return '';
      }

      console.log(`Searching for: "${query}" in ${this.chunks.length} chunks`);

      const queryEmbedding = await this.getEmbedding(query);

      const similarities = this.chunks.map(chunk => ({
        chunk,
        score: chunk.embedding ?
          this.cosineSimilarity(queryEmbedding, chunk.embedding) :
          this.textSimilarity(query, chunk.text)
      }));

      similarities.sort((a, b) => b.score - a.score);
      const topChunks = similarities.slice(0, topK);

      // Dynamischer Threshold basierend auf den Scores
      const maxScore = topChunks[0]?.score || 0;
      const threshold = Math.max(0.3, maxScore * 0.5); // Mindestens 50% des besten Scores
      
      const relevantChunks = topChunks.filter(item => item.score > threshold);

      if (relevantChunks.length === 0) {
        console.log('No relevant chunks found');
        return '';
      }

      console.log(`Found ${relevantChunks.length} relevant chunks with scores:`, 
        relevantChunks.map(c => c.score.toFixed(3)));

      // Formatiere Kontext mit besserer Struktur
      return relevantChunks
        .map(item => {
          const source = item.chunk.source;
          const text = item.chunk.text;
          return `[Source: ${source}]\n${text}`;
        })
        .join('\n\n---\n\n');
    } catch (error) {
      console.error('Error searching documents:', error);
      return '';
    }
  }

  private textSimilarity(query: string, text: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const textLower = text.toLowerCase();
    let matches = 0;

    queryWords.forEach(word => {
      if (textLower.includes(word)) {
        matches++;
      }
    });

    return matches / queryWords.length;
  }

  async listDocuments(): Promise<Array<{ id: string, name: string, uploadDate: Date }>> {
    return Array.from(this.documents.entries()).map(([id, doc]) => ({
      id,
      ...doc
    }));
  }

  async deleteDocument(docId: string): Promise<void> {
    const doc = this.documents.get(docId);
    if (!doc) {
      throw new Error('Document not found');
    }

    this.chunks = this.chunks.filter(chunk => chunk.source !== doc.name);
    this.documents.delete(docId);
    
    console.log(`Document ${doc.name} deleted`);
  }

  private async parseFile(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    const fileBuffer = await fs.readFile(filePath);

    switch (ext) {
      case '.txt':
      case '.md':
        return fileBuffer.toString('utf-8');

      case '.pdf':
        try {
          const pdfParse = require('pdf-parse');
          const pdfData = await pdfParse(fileBuffer);
          return pdfData.text;
        } catch (error) {
          console.error('PDF parsing error:', error);
          throw new Error('Failed to parse PDF file. Make sure pdf-parse is installed.');
        }

      case '.docx':
        try {
          const mammoth = require('mammoth');
          const result = await mammoth.extractRawText({ buffer: fileBuffer });
          return result.value;
        } catch (error) {
          console.log('DOCX parsing not available, treating as text');
          return fileBuffer.toString('utf-8');
        }

      default:
        return fileBuffer.toString('utf-8');
    }
  }

  private generateDocId(filename: string): string {
    return `${Date.now()}_${filename.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  // Utility-Methode zum Abrufen der Statistiken
  getStats() {
    return {
      totalDocuments: this.documents.size,
      totalChunks: this.chunks.length,
      documents: Array.from(this.documents.entries()).map(([id, doc]) => ({
        id,
        name: doc.name,
        uploadDate: doc.uploadDate,
        chunks: this.chunks.filter(c => c.source === doc.name).length
      }))
    };
  }
}