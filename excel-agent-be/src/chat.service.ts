import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);
    // Local Ollama instance URL (defaults to 11434)
    private readonly ollamaUrl = 'http://127.0.0.1:11434/api/generate';

    async generateResponse(userPrompt: string, excelContext: string): Promise<string> {
        // Construct the Context-Augmented Generation (CAG) prompt
        const systemPrompt = `You are an expert AI assistant operating inside Microsoft Excel.
Your task is to answer the user's question based Strictly and Exclusively on the provided JSON data representing the current worksheet.

CRITICAL INSTRUCTIONS:
1. ONLY use the data provided below. NEVER invent, guess, hallucinate, or synthesize information, names, numbers, or facts.
2. If the user's question cannot be completely answered using the provided data, you MUST reply with exactly: "I cannot answer this based on the provided spreadsheet data. Note that data must be in the active worksheet."
3. When answering, be concise and direct. Do not add conversational filler.
4. If the data is empty ("[]") or missing, inform the user that their worksheet appears to be empty and there is no data to answer questions about.

--- CURRENT SPREADSHEET DATA (JSON ARRAY) ---
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
            first10Lines = contextLines.slice(0, 10).join('\n');
        }

        this.logger.log(`Sending prompt to local Llama 3 (Context length: ${excelContext?.length || 0} chars)\nFirst few records of context:\n${first10Lines}`);

        try {
            const response = await fetch(this.ollamaUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama3.1', // Must match the model installed on the user's machine
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
}
