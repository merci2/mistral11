// backend/src/services/chatService.ts

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MistralResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    index: number;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ChatResponse {
  response: string;
  sources?: string[];
}

export class ChatService {
  private conversationHistory: Map<string, Message[]> = new Map();
  private mistralApiKey: string;

  constructor() {
    this.mistralApiKey = process.env.MISTRAL_API_KEY || '';
  }

  async chat(message: string, context: string, model: string, userId?: string): Promise<ChatResponse> {
    try {
      // Get or create conversation history for user
      const sessionId = userId || 'default';
      if (!this.conversationHistory.has(sessionId)) {
        this.conversationHistory.set(sessionId, []);
      }
      
      const history = this.conversationHistory.get(sessionId)!;
      
      // Build system message with context
      const systemMessage = this.buildSystemMessage(context);
      
      // Add user message to history
      history.push({ role: 'user', content: message });
      
      // Prepare messages for API
      const messages: Message[] = [
        { role: 'system', content: systemMessage },
        ...history.slice(-10) // Keep last 10 messages for context
      ];
      
      // Call Mistral API directly
      const assistantMessage = await this.callMistralAPI(messages, model);
      
      // Add assistant response to history
      history.push({ role: 'assistant', content: assistantMessage });
      
      // Limit history size
      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }
      
      // Extract sources from context
      const sources = this.extractSources(context);
      
      return {
        response: assistantMessage,
        sources: sources.length > 0 ? sources : undefined
      };
    } catch (error) {
      console.error('Chat error:', error);
      // Fallback response
      return {
        response: this.getFallbackResponse(message),
        sources: undefined
      };
    }
  }

  private async callMistralAPI(messages: Message[], model: string): Promise<string> {
    if (!this.mistralApiKey) {
      throw new Error('Mistral API key not configured');
    }

    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.mistralApiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: 0.3,  // Niedrigere Temperatur für präzisere Antworten
          max_tokens: 200,   // Begrenzte Tokens für kürzere Antworten
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Mistral API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as MistralResponse;
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from Mistral API');
      }
      
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Mistral API call failed:', error);
      throw error;
    }
  }

  private buildSystemMessage(context: string): string {
    let systemMessage = `You are a helpful assistant for a website. 

CRITICAL INSTRUCTIONS:
1. Be EXTREMELY CONCISE - maximum 2-3 sentences per response
2. Give direct, precise answers without unnecessary elaboration
3. When citing contact information (emails, phone numbers, URLs), always provide them COMPLETELY and EXACTLY as shown
4. NEVER truncate or shorten email addresses - always include the full domain (.com, .de, etc.)
5. Do not add pleasantries or filler text

Website Information:
- Company: MyApp
- Services: Web Development, Mobile Apps, Consulting
- Products: Product A (Enterprise), Product B (SMB)
- Location: Berlin, Germany
- Contact: info@myapp.com, +49 123 456 789

Available Pages:
- Home: Overview of services
- About: Company information
- Services: Web Development, Mobile Apps, Consulting
- Products: Enterprise and SMB solutions
- Blog: Latest articles and updates
- Contact: Contact form and information
- FAQ: Frequently asked questions`;

    if (context) {
      systemMessage += `\n\nRELEVANT KNOWLEDGE BASE INFORMATION:\n${context}\n\nIMPORTANT: Use the knowledge base information above to answer. If contact details appear in the knowledge base, use those EXACTLY as written, including complete email addresses with full domains.`;
    }

    systemMessage += `\n\nRemember: Keep responses SHORT (2-3 sentences max) and ACCURATE. Always provide complete email addresses and contact information.`;

    return systemMessage;
  }

  private extractSources(context: string): string[] {
    const sources: string[] = [];
    if (!context) return sources;
    
    // Extract source names from context format: [Source: filename]
    const sourcePattern = /\[Source: ([^\]]+)\]/g;
    let match;
    
    while ((match = sourcePattern.exec(context)) !== null) {
      const source = match[1];
      if (!sources.includes(source)) {
        sources.push(source);
      }
    }
    
    return sources;
  }

  private getFallbackResponse(message: string): string {
    const messageLower = message.toLowerCase();
    
    // Kurze, präzise Fallback-Antworten
    if (messageLower.includes('hello') || messageLower.includes('hi')) {
      return 'Hello! How can I help you?';
    }
    
    if (messageLower.includes('services')) {
      return 'We offer Web Development, Mobile Apps, and Consulting services.';
    }
    
    if (messageLower.includes('contact')) {
      return 'Contact us at info@myapp.com or +49 123 456 789.';
    }
    
    if (messageLower.includes('product')) {
      return 'We offer Product A for enterprises and Product B for SMBs.';
    }
    
    return 'I cannot access the AI service right now. Please contact info@myapp.com for assistance.';
  }

  clearHistory(userId?: string): void {
    const sessionId = userId || 'default';
    this.conversationHistory.delete(sessionId);
  }
}