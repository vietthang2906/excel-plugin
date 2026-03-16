import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);
    // Local Ollama instance URL (defaults to 11434)
    private readonly ollamaUrl = 'http://127.0.0.1:11434/api/generate';

    async generateResponse(userPrompt: string, excelContext: string): Promise<string> {
        // Construct the Agentic Answer generation prompt
        const systemPrompt = `You are an expert AI assistant operating inside Microsoft Excel.
Your task is to answer the user's question based Strictly and Exclusively on the provided data representing a subset of the current worksheet.

CRITICAL INSTRUCTIONS:
1. ONLY use the data provided below. NEVER invent, guess, hallucinate, or synthesize information, names, numbers, or facts.
2. If the user's question cannot be completely answered using the provided data, you MUST reply with exactly: "I cannot answer this based on the provided spreadsheet data. Note that data must be in the active worksheet."
3. When answering, be concise and direct. Do not add conversational filler.
4. If the data is empty or missing, inform the user that their worksheet appears to be empty and there is no data to answer questions about.

--- EXCEL SUBSET DATA ---
${excelContext || "[]"}
--------------------------------`;

        const fullPrompt = `${systemPrompt}\n\nUser Question: ${userPrompt}\n\nAnswer:`;

        let first10Lines = '';
        try {
            const parsed = JSON.parse(excelContext || '[]');
            const displayData = Array.isArray(parsed) ? parsed.slice(0, 5) : parsed;
            first10Lines = JSON.stringify(displayData, null, 2);
        } catch (e) {
            const contextLines = (excelContext || '').split(/\r?\n/);
            first10Lines = contextLines.slice(0, 100).join('\n');
        }

        this.logger.log(`Sending prompt to local model (Context length: ${excelContext?.length || 0} chars)\n--- FULL PROMPT ---\n${fullPrompt}\n-------------------`);

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
                    // Additional parameters like temperature can go here
                    options: {
                        temperature: 0.1 // Lower temp for more analytical/factual responses
                    }
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama API returned status: ${response.status}`);
            }

            const data = (await response.json()) as any;
            return data.response.trim();

        } catch (error) {
            this.logger.error('Failed to communicate with Ollama', error);
            throw error;
        }
    }

    async routeTask(userPrompt: string, schema: any): Promise<any> {
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

        const systemPrompt = `You are an expert Data Router AI for Microsoft Excel.
Your goal is to inspect the user's question and the Schema of the active worksheet and decide IF you need to fetch specific data rows to answer the question, or if you should fetch all data.

--- WORKSHEET SCHEMA ---
Full Data Range: ${schema.fullRangeAddress}
Total Rows: ${schema.rowCount}
Total Columns: ${schema.columnCount}
Headers Mapping:
${headerMapping}
------------------------

CRITICAL INSTRUCTIONS:
1. Respond ONLY with a valid JSON object. Do NOT wrap it in markdown block quotes (like \`\`\`json). Just the raw object.
2. If the user's question requires finding a specific person, ID, or searching, use "fetch_all" because you don't know what row they are in.
3. If the user's question references a specific row number, calculate the Excel range (matching the Headers Mapping columns exactly) and use "fetch". 

Allowed JSON Output formats:
To fetch everything (best for searching/aggregating):
{ "action": "fetch_all" }

To fetch specific rows (best if row number is explicitly requested):
{ "action": "fetch", "range": "A5:C5" }`;

        const fullPrompt = `${systemPrompt}\n\nUser Question: ${userPrompt}\n\nAgent Output:`;

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
                    // We can specify format: 'json' with Ollama if the model supports it out of the box
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
