import { ConfigService } from '@nestjs/config';
import { ClassifierService } from './llm/classifier.service';
import { AnthropicProvider } from './llm/providers/anthropic.provider';
import { DeepSeekProvider } from './llm/providers/deepseek.provider';
import { OllamaProvider } from './llm/providers/ollama.provider';
import { QwenProvider } from './llm/providers/qwen.provider';
export declare class ChatService {
    private readonly configService;
    private readonly classifierService;
    private readonly anthropicProvider;
    private readonly deepSeekProvider;
    private readonly qwenProvider;
    private readonly ollamaProvider;
    private readonly logger;
    constructor(configService: ConfigService, classifierService: ClassifierService, anthropicProvider: AnthropicProvider, deepSeekProvider: DeepSeekProvider, qwenProvider: QwenProvider, ollamaProvider: OllamaProvider);
    generateResponse(userPrompt: string, excelContext: string, schema?: {
        rowCount?: number;
    }): Promise<{
        reply: string;
        model_used: string;
    }>;
    private getFallbackOrder;
    private parseProviderList;
    routeTask(userPrompt: string, schema: any): Promise<any>;
    private getRouterProviderAndModel;
    private enrichFetchAllWithSheets;
    private parseRouterOutput;
}
