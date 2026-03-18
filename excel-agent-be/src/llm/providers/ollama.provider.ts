import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProvider } from '../llm-provider.interface';

@Injectable()
export class OllamaProvider implements LlmProvider {
    private readonly logger = new Logger(OllamaProvider.name);
    readonly name = 'Ollama';
    private readonly baseUrl: string;
    private readonly model: string;
    private readonly maxOutputTokens: number;

    constructor(private readonly configService: ConfigService) {
        this.baseUrl =
            this.configService.get<string>('OLLAMA_BASE_URL') ?? 'http://127.0.0.1:11434/api/chat';
        this.model = this.configService.get<string>('OLLAMA_MODEL') ?? 'llama3:70b';
        this.maxOutputTokens =
            parseInt(this.configService.get<string>('MAX_OUTPUT_TOKENS') ?? '512', 10) || 512;
    }

    async chat(
        systemPrompt: string,
        userPrompt: string,
        context: string,
        modelOverride?: string,
    ): Promise<string> {
        const model = modelOverride ?? this.model;
        const userContent = `${context || ''}\n\nUser Question: ${userPrompt}`;

        this.logger.log(
            `[LLM_REQUEST] model=${model} | systemLen=${systemPrompt.length} | userContentLen=${userContent.length}`,
        );

        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContent }
                ],
                stream: false,
                options: { num_predict: this.maxOutputTokens },
            }),
        });

        if (!response.ok) {
            const errBody = await response.text();
            this.logger.error(`[LLM_RESPONSE] status=${response.status} | error=${errBody.slice(0, 200)}`);
            throw new Error(`Ollama returned status ${response.status}: ${errBody}`);
        }

        const data = (await response.json()) as { message?: { content?: string } };
        let content = (data.message?.content ?? '').trim();

        // Remove <think>...</think> blocks from reasoning models
        content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        this.logger.log(
            `[LLM_RESPONSE] status=${response.status} | contentLen=${content.length} | preview="${content.slice(0, 100)}${content.length > 100 ? '...' : ''}"`,
        );
        return content;
    }
}
