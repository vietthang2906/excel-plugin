import { Injectable, Logger } from '@nestjs/common';
import { PromptService } from './prompt.service';

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);
    // Local Ollama instance URL (defaults to 11434)
    private readonly ollamaUrl = 'http://127.0.0.1:11434/api/generate';

    constructor(private readonly promptService: PromptService) { }

    async generateResponse(userPrompt: string, excelContext: string): Promise<string> {
        const fullPrompt = this.promptService.buildAnswerPrompt(excelContext, userPrompt);

        this.logger.log(`Sending prompt to local model (Context length: ${excelContext?.length || 0} chars)\n---------`);

        try {
            const response = await fetch(this.ollamaUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'deepseek-r1:8b', // Must match the model installed on the user's machine
                    prompt: fullPrompt,
                    stream: false,
                    options: {
                        temperature: 0.1 // Lower temp for more analytical/factual responses
                    }
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama API returned status: ${response.status}`);
            }

            const data = (await response.json()) as any;
            let textResponse = data.response.trim();

            // Remove <think>...</think> blocks from reasoning models (like deepseek-r1)
            textResponse = textResponse.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

            return textResponse;

        } catch (error) {
            this.logger.error('Failed to communicate with Ollama', error);
            throw error;
        }
    }

    async routeTask(userPrompt: string, schema: any, structureContext?: string): Promise<any> {
        if (schema.isEmpty) {
            return { action: 'answer', reply: "The current worksheet is empty." };
        }

        const getColumnLetter = (colIndex: number): string => {
            let letter = '';
            let temp = colIndex;
            while (temp >= 0) {
                letter = String.fromCharCode((temp % 26) + 65) + letter;
                temp = Math.floor(temp / 26) - 1;
            }
            return letter;
        };

        const getColumnIndex = (letter: string): number => {
            let index = 0;
            for (let i = 0; i < letter.length; i++) {
                index = index * 26 + (letter.charCodeAt(i) - 64);
            }
            return index - 1;
        };

        const startColMatch = schema.fullRangeAddress.match(/([A-Z]+)\d+/);
        const startColLetter = startColMatch ? startColMatch[1] : 'A';
        const startColIndex = getColumnIndex(startColLetter);

        const headerMapping = schema.headers.map((header: string, index: number) => {
            return `Column ${getColumnLetter(startColIndex + index)}: "${header}"`;
        }).join('\n');

        // Build the schema block that replaces {{SCHEMA_BLOCK}} in the template
        const schemaBlock = `Active Worksheet: ${schema.sheetName}
Full Data Range: ${schema.fullRangeAddress}
Total Rows: ${schema.rowCount}
Total Columns: ${schema.columnCount}
Headers Mapping:
${headerMapping}`;

        const fullPrompt = this.promptService.buildRouterPrompt(schemaBlock, userPrompt, structureContext);

        this.logger.log(`Routing Task for user prompt: "${userPrompt}"\n--- FULL ROUTER PROMPT ---\n${fullPrompt}\n--------------------------`);

        try {
            const response = await fetch(this.ollamaUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama3.1', // Must match the model installed
                    prompt: fullPrompt,
                    stream: false,
                    options: {
                        temperature: 0.0 // Zero temperature for strict routing deterministic output
                    },
                    format: 'json'
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama API returned status: ${response.status}`);
            }

            const data = (await response.json()) as any;
            const textResponse = data.response.trim();

            this.logger.log(`Router Output: ${textResponse}`);

            try {
                return JSON.parse(textResponse);
            } catch (e) {
                this.logger.error("Failed to parse Router output as JSON. Falling back to fetch_all.");
                return { action: 'fetch_all' };
            }

        } catch (error) {
            this.logger.error('Failed to communicate with Ollama Router', error);
            throw error;
        }
    }
}
