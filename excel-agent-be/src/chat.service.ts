import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);
    private readonly apiKey: string;
    private readonly apiUrl = 'https://api.anthropic.com/v1/messages';
    private readonly model: string;

    constructor(private readonly configService: ConfigService) {
        this.apiKey = this.configService.getOrThrow<string>('ANTHROPIC_API_KEY');
        this.model = this.configService.get<string>('CLAUDE_MODEL') ?? 'claude-sonnet-4-6';
    }

    async generateResponse(
        userPrompt: string,
        excelContext: string,
        history: Array<{ role: string; content: string }> = [],
    ): Promise<string> {
        const systemPrompt = `You are an expert AI assistant operating inside Microsoft Excel.
Your task is to answer the user's question based Strictly and Exclusively on the provided JSON data representing all worksheets in the workbook.

The data is structured as an object where each key is a sheet name and each value is an array of row objects (first row = headers).

CRITICAL INSTRUCTIONS:
1. ONLY use the data provided below. NEVER invent, guess, hallucinate, or synthesize information, names, numbers, or facts.
2. If the user's question cannot be completely answered using the provided data, you MUST reply with exactly: "I cannot answer this based on the provided spreadsheet data."
3. When answering, be concise and direct. Do not add conversational filler.
4. If the data is empty or all sheets are empty, inform the user that the workbook appears to have no data to answer questions about.
5. When referencing data from multiple sheets, indicate which sheet(s) the data comes from.

--- WORKBOOK DATA (ALL SHEETS) ---
${excelContext || '{}'}
--------------------------------`;

        let first10Lines = '';
        try {
            const parsed = JSON.parse(excelContext || '{}');
            let displayData = parsed;
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                displayData = Object.fromEntries(
                    Object.entries(parsed).slice(0, 2).map(([k, v]) => [
                        k,
                        Array.isArray(v) ? v.slice(0, 3) : v,
                    ]),
                );
            } else if (Array.isArray(parsed)) {
                displayData = parsed.slice(0, 5);
            }
            first10Lines = JSON.stringify(displayData, null, 2);
        } catch (e) {
            const contextLines = (excelContext || '').split(/\r?\n/);
            first10Lines = contextLines.slice(0, 10).join('\n');
        }

        this.logger.log(
            `Sending prompt to Claude (Context length: ${excelContext?.length || 0} chars)\nFirst few records of context:\n${first10Lines}`,
        );

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: 1024,
                    system: systemPrompt,
                    messages: [
                        ...history
                            .filter((m) => m.role === 'user' || m.role === 'assistant')
                            .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
                        { role: 'user' as const, content: userPrompt },
                    ],
                }),
            });

            if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`Claude API returned status ${response.status}: ${errBody}`);
            }

            const data = (await response.json()) as {
                content: Array<{ type: string; text?: string }>;
            };
            const textBlock = data.content?.find((b) => b.type === 'text');
            return (textBlock?.text ?? '').trim();
        } catch (error) {
            this.logger.error('Failed to communicate with Claude API', error);
            throw error;
        }
    }
}
