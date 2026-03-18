import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProvider } from '../llm-provider.interface';

@Injectable()
export class QwenProvider implements LlmProvider {
    private readonly logger = new Logger(QwenProvider.name);
    readonly name = 'Qwen';
    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly model: string;
    private readonly maxOutputTokens: number;

    constructor(private readonly configService: ConfigService) {
        this.apiKey = this.configService.get<string>('DASHSCOPE_API_KEY') ?? '';
        this.baseUrl =
            this.configService.get<string>('DASHSCOPE_BASE_URL') ??
            'https://dashscope.aliyuncs.com/compatible-mode/v1';
        this.model = this.configService.get<string>('QWEN_MODEL') ?? 'qwen-turbo';
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
            throw new Error('DASHSCOPE_API_KEY is not configured');
        }

        const model = modelOverride ?? this.model;
        const userContent = `${context || ''}\n\nUser Question: ${userPrompt}`;

        this.logger.log(
            `[LLM_REQUEST] model=${model} | systemLen=${systemPrompt.length} | userContentLen=${userContent.length}`,
        );

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContent },
                ],
                max_tokens: this.maxOutputTokens,
                temperature: 0.1,
            }),
        });

        if (!response.ok) {
            const errBody = await response.text();
            this.logger.error(`[LLM_RESPONSE] status=${response.status} | error=${errBody.slice(0, 200)}`);
            throw new Error(`Qwen/DashScope API returned status ${response.status}: ${errBody}`);
        }

        const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        const content = (data.choices?.[0]?.message?.content ?? '').trim();
        this.logger.log(
            `[LLM_RESPONSE] status=${response.status} | contentLen=${content.length} | preview="${content.slice(0, 100)}${content.length > 100 ? '...' : ''}"`,
        );
        return content;
    }
}
