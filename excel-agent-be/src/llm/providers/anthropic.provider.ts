import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProvider } from '../llm-provider.interface';

@Injectable()
export class AnthropicProvider implements LlmProvider {
    private readonly logger = new Logger(AnthropicProvider.name);
    readonly name = 'Claude';
    private readonly apiKey: string;
    private readonly baseUrl = 'https://api.anthropic.com/v1/messages';
    private readonly model: string;
    private readonly maxOutputTokens: number;

    constructor(private readonly configService: ConfigService) {
        this.apiKey = this.configService.get<string>('ANTHROPIC_API_KEY') ?? '';
        this.model = this.configService.get<string>('ANTHROPIC_MODEL') ?? 'claude-opus-4-6';
        this.maxOutputTokens =
            parseInt(this.configService.get<string>('MAX_OUTPUT_TOKENS') ?? '512', 10) || 512;
    }

    isAvailable(): boolean {
        return !!this.apiKey;
    }

    async chat(
        systemPrompt: string,
        userPrompt: string,
        context: string,
        modelOverride?: string,
    ): Promise<string> {
        if (!this.apiKey) {
            throw new Error('ANTHROPIC_API_KEY is not configured');
        }

        const model = modelOverride ?? this.model;
        const userContent = `${context || ''}\n\nUser Question: ${userPrompt}`;

        this.logger.log(
            `[LLM_REQUEST] model=${model} | systemLen=${systemPrompt.length} | userContentLen=${userContent.length}`,
        );

        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model,
                max_tokens: this.maxOutputTokens,
                system: systemPrompt,
                messages: [{ role: 'user', content: userContent }],
            }),
        });

        if (!response.ok) {
            const errBody = await response.text();
            this.logger.error(`[LLM_RESPONSE] status=${response.status} | error=${errBody.slice(0, 200)}`);
            throw new Error(`Anthropic API returned status ${response.status}: ${errBody}`);
        }

        const data = (await response.json()) as {
            content?: Array<{ type?: string; text?: string }>;
        };
        const content = (data.content?.[0]?.text ?? '').trim();

        this.logger.log(
            `[LLM_RESPONSE] status=${response.status} | contentLen=${content.length} | preview="${content.slice(0, 100)}${content.length > 100 ? '...' : ''}"`,
        );
        return content;
    }
}
