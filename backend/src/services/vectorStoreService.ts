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
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2) || 1);
  }

  // Text in Chunks aufteilen
  private splitText(text: string, chunkSize: number = 500): string[] {
    const chunks: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += ' ' + sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  async addDocument(filePath: string, originalName: string): Promise<void> {
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

  async searchSimilar(query: string, topK: number = 5): Promise<string> {
    try {
      if (this.chunks.length === 0) {
        return '';
      }

      const queryEmbedding = await this.getEmbedding(query);

      const similarities = this.chunks.map(chunk => ({
        chunk,
        score: chunk.embedding ?
          this.cosineSimilarity(queryEmbedding, chunk.embedding) :
          this.textSimilarity(query, chunk.text)
      }));

      similarities.sort((a, b) => b.score - a.score);
      const topChunks = similarities.slice(0, topK);

      const relevantChunks = topChunks.filter(item => item.score > 0.3);

      if (relevantChunks.length === 0) {
        return '';
      }

      return relevantChunks
        .map(item => `From "${item.chunk.source}":\n${item.chunk.text}`)
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
          console.log('PDF parsing not available, treating as text');
          return fileBuffer.toString('utf-8');
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
}
