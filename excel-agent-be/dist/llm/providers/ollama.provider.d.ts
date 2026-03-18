import { ConfigService } from '@nestjs/config';
import { LlmProvider } from '../llm-provider.interface';
export declare class OllamaProvider implements LlmProvider {
    private readonly configService;
    private readonly logger;
    readonly name = "Ollama";
    private readonly baseUrl;
    private readonly model;
    private readonly maxOutputTokens;
    constructor(configService: ConfigService);
    chat(systemPrompt: string, userPrompt: string, context: string, modelOverride?: string): Promise<string>;
}
