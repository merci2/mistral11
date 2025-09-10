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

export class ChatService {
  private conversationHistory: Map<string, Message[]> = new Map();
  private mistralApiKey: string;

  constructor() {
    this.mistralApiKey = process.env.MISTRAL_API_KEY || '';
  }

  async chat(message: string, context: string, model: string, userId?: string): Promise<string> {
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
      
      return assistantMessage;
    } catch (error) {
      console.error('Chat error:', error);
      // Fallback response
      return this.getFallbackResponse(message);
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
          temperature: 0.7,
          max_tokens: 1000,
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
    let systemMessage = `You are a helpful assistant for a website. You can answer questions about:
1. The website content and services
2. Information from the knowledge base documents

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
      systemMessage += `\n\nRelevant information from knowledge base:\n${context}`;
    }

    systemMessage += `\n\nPlease provide helpful, accurate, and concise answers. If you don't have information about something specific, say so politely.`;

    return systemMessage;
  }

  private getFallbackResponse(message: string): string {
    const messageLower = message.toLowerCase();
    
    // Einfache Fallback-Antworten
    if (messageLower.includes('hello') || messageLower.includes('hi')) {
      return 'Hello! How can I help you today?';
    }
    
    if (messageLower.includes('services')) {
      return 'We offer Web Development, Mobile Apps, and Consulting services. Would you like to know more about any specific service?';
    }
    
    if (messageLower.includes('contact')) {
      return 'You can reach us at info@myapp.com or call +49 123 456 789. You can also use the contact form on our Contact page.';
    }
    
    if (messageLower.includes('product')) {
      return 'We have two main products: Product A for enterprise clients and Product B for small and medium businesses. Which one interests you?';
    }
    
    return 'I apologize, but I\'m having trouble connecting to my AI service right now. You can still browse our website or contact us directly at info@myapp.com for assistance.';
  }

  clearHistory(userId?: string): void {
    const sessionId = userId || 'default';
    this.conversationHistory.delete(sessionId);
  }
}