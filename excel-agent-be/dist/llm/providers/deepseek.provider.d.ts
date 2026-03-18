import { ConfigService } from '@nestjs/config';
import { LlmProvider } from '../llm-provider.interface';
export declare class DeepSeekProvider implements LlmProvider {
    private readonly configService;
    private readonly logger;
    readonly name = "DeepSeek";
    private readonly apiKey;
    private readonly baseUrl;
    private readonly model;
    private readonly maxOutputTokens;
    constructor(configService: ConfigService);
    isAvailable(): boolean;
    chat(systemPrompt: string, userPrompt: string, context: string, modelOverride?: string): Promise<string>;
}
