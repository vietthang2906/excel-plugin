"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ChatService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
let ChatService = ChatService_1 = class ChatService {
    logger = new common_1.Logger(ChatService_1.name);
    ollamaUrl = 'http://127.0.0.1:11434/api/generate';
    async generateResponse(userPrompt, excelContext) {
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
        }
        catch (e) {
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
                    model: 'deepseek-r1:8b',
                    prompt: fullPrompt,
                    stream: false,
                    options: {
                        temperature: 0.1
                    }
                }),
            });
            if (!response.ok) {
                throw new Error(`Ollama API returned status: ${response.status}`);
            }
            const data = (await response.json());
            let textResponse = data.response.trim();
            textResponse = textResponse.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            return textResponse;
        }
        catch (error) {
            this.logger.error('Failed to communicate with Ollama', error);
            throw error;
        }
    }
    async routeTask(userPrompt, schema) {
        if (schema.isEmpty) {
            return { action: 'answer', reply: "The current worksheet is empty." };
        }
        const getColumnLetter = (colIndex) => {
            let letter = '';
            let temp = colIndex;
            while (temp >= 0) {
                letter = String.fromCharCode((temp % 26) + 65) + letter;
                temp = Math.floor(temp / 26) - 1;
            }
            return letter;
        };
        const getColumnIndex = (letter) => {
            let index = 0;
            for (let i = 0; i < letter.length; i++) {
                index = index * 26 + (letter.charCodeAt(i) - 64);
            }
            return index - 1;
        };
        const startColMatch = schema.fullRangeAddress.match(/([A-Z]+)\d+/);
        const startColLetter = startColMatch ? startColMatch[1] : 'A';
        const startColIndex = getColumnIndex(startColLetter);
        const headerMapping = schema.headers.map((header, index) => {
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
2. ONLY use "fetch" if the user EXPLICITLY says "Row X". If they say "record X" or "ID X" or "number X", they are NOT asking for a row index. They are asking to search for a value.
3. When using "search", carefully distinguish between the column the user wants to *retrieve* and the column they want to *search by*. For example, in "value of the permanent_id of records 146", the value "146" belongs to an ID or Ordinal column, NOT the permanent_id column.
4. If the user asks to find a record by a number (like "record 146"), look at the Headers Mapping and find the column that actually contains sequence numbers or IDs (like "Ordinal Number" or "ID"), and use that exact header name for the "column" field.
5. Do NOT blindly copy the examples below. Calculate actual ranges or use actual column names from the Headers Mapping.

Allowed JSON Output formats:
To fetch everything (best for aggregating, counting, or when unsure):
{ "action": "fetch_all" }

To fetch specific Excel rows (ONLY IF "Row X" is explicitly requested):
{ "action": "fetch", "range": "<CALCULATED_RANGE>" }

To search for a specific value in a column (e.g. finding "record 146" means search the "Ordinal Number" column, not the return column):
{ "action": "search", "column": "<EXACT_HEADER_NAME>", "value": "146" }`;
        const fullPrompt = `${systemPrompt}\n\nUser Question: ${userPrompt}\n\nAgent Output:`;
        this.logger.log(`Routing Task for user prompt: "${userPrompt}"\n--- FULL ROUTER PROMPT ---\n${fullPrompt}\n--------------------------`);
        try {
            const response = await fetch(this.ollamaUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama3.1',
                    prompt: fullPrompt,
                    stream: false,
                    options: {
                        temperature: 0.0
                    },
                    format: 'json'
                }),
            });
            if (!response.ok) {
                throw new Error(`Ollama API returned status: ${response.status}`);
            }
            const data = (await response.json());
            const textResponse = data.response.trim();
            this.logger.log(`Router Output: ${textResponse}`);
            try {
                return JSON.parse(textResponse);
            }
            catch (e) {
                this.logger.error("Failed to parse Router output as JSON. Falling back to fetch_all.");
                return { action: 'fetch_all' };
            }
        }
        catch (error) {
            this.logger.error('Failed to communicate with Ollama Router', error);
            throw error;
        }
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = ChatService_1 = __decorate([
    (0, common_1.Injectable)()
], ChatService);
//# sourceMappingURL=chat.service.js.map