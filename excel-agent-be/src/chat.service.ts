import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TaskType } from './llm/classifier.service';
import { ClassifierService } from './llm/classifier.service';
import type { LlmProvider } from './llm/llm-provider.interface';
import { AnthropicProvider } from './llm/providers/anthropic.provider';
import { DeepSeekProvider } from './llm/providers/deepseek.provider';
import { OllamaProvider } from './llm/providers/ollama.provider';
import { QwenProvider } from './llm/providers/qwen.provider';

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly classifierService: ClassifierService,
        private readonly anthropicProvider: AnthropicProvider,
        private readonly deepSeekProvider: DeepSeekProvider,
        private readonly qwenProvider: QwenProvider,
        private readonly ollamaProvider: OllamaProvider,
    ) {}

    async generateResponse(
        userPrompt: string,
        excelContext: string,
        schema?: { rowCount?: number },
    ): Promise<{ reply: string; model_used: string }> {
        const contextLen = excelContext?.length ?? 0;
        this.logger.log(
            `[REQUEST] prompt="${userPrompt.slice(0, 100)}${userPrompt.length > 100 ? '...' : ''}" | contextLen=${contextLen} | rowCount=${schema?.rowCount ?? 'n/a'}`,
        );

        const systemPrompt = `You are an Excel AI assistant. Answer ONLY from the provided data.

## OUTPUT STYLE — CRITICAL
- Give the result DIRECTLY. No preamble, no explanation, no "Based on the data...".
- For calculations: state the answer (number/formula) immediately.
- For lookups: state the found value or row.
- For counts/sums/averages: one line with the result and formula if useful.
- NO explanations unless the user explicitly asks "how" or "why".
- Maximum 2–3 sentences. Prefer single-line answers.

## Data format
Context is Coordinate-Mapped CSV: first row = headers, subsequent rows = data. Use column names and cell references (e.g., A2:A100).

## Core rules
1. Use ONLY provided data. Never invent or guess.
2. If unanswerable, reply: "I cannot answer this based on the provided spreadsheet data."
3. If data is empty, say so.

## Calculations — give RESULT first
When answering sum, average, count, or similar:
- Compute from the provided data and state the NUMERIC RESULT first (e.g. "150" or "Tổng: 450").
- Do NOT return only a formula. The user asked for the answer, not how to compute it.
- Optionally add the formula on a second line for verification (e.g. "Formula: =SUM(...)").
- If user explicitly asks "how to calculate" or "formula", then provide the formula.

## Limitations (you cannot execute these)
- Create/download files, VBA, macros, or exports
- Access external APIs or live data
- Modify the spreadsheet directly — you give advice; the user performs actions
When users ask to add, change, or write data: explain step-by-step what to do (e.g., "Put =SUM(A2:A10) in cell B11").

## Overwrite protection
When suggesting writing to cells that may already have data: remind the user to confirm before overwriting.

## Read vs write intent
- Read-only (analyze, sum, average, show): Answer directly; suggest formulas if useful.
- Write intent (add, put, update, delete): Explain the exact steps and formulas; do not assume you can execute.`;

        const rowCount = schema?.rowCount;

        let taskType: TaskType = 'simple';
        try {
            taskType = await this.classifierService.classify(userPrompt, excelContext, rowCount);
            this.logger.log(`[CLASSIFIER] taskType=${taskType}`);
        } catch (error) {
            this.logger.warn('[CLASSIFIER] failed, using simple', error);
        }

        const fallbackOrder = this.getFallbackOrder(taskType);
        const wrappedContext = `--- EXCEL DATA ---\n${excelContext || '[]'}\n---`;

        const providerNames = fallbackOrder.map((e) => (e.model ? `${e.provider.name}@${e.model}` : e.provider.name)).join(' -> ');
        this.logger.log(
            `[ROUTING] taskType=${taskType} | fallbackOrder=${providerNames} | steps=${fallbackOrder.length}`,
        );

        const truncate = (s: string, len: number) =>
            s.length <= len ? s : s.slice(0, len) + '...';

        for (let i = 0; i < fallbackOrder.length; i++) {
            const { provider: p, model } = fallbackOrder[i];
            const step = i + 1;
            this.logger.log(`[PROVIDER_STEP] step=${step}/${fallbackOrder.length} | trying=${p.name}${model ? `@${model}` : ''}`);

            this.logger.log(
                `[PROMPT_TO_PROVIDER] provider=${p.name} | model=${model ?? 'default'} | systemLen=${systemPrompt.length} | userPrompt="${truncate(userPrompt, 300)}" | contextLen=${wrappedContext.length} | contextPreview="${truncate(wrappedContext, 200)}"`,
            );

            try {
                const reply = await p.chat(systemPrompt, userPrompt, wrappedContext, model);
                this.logger.log(
                    `[PROVIDER_SUCCESS] step=${step} | provider=${p.name} | replyLen=${reply.length} | preview="${reply.slice(0, 150)}${reply.length > 150 ? '...' : ''}"`,
                );
                return { reply, model_used: p.name };
            } catch (error) {
                this.logger.warn(
                    `[PROVIDER_FAIL] step=${step} | provider=${p.name} | failed, trying next`,
                    error,
                );
            }
        }

        throw new Error('All LLM providers failed. Check API keys and Ollama connection.');
    }

    private getFallbackOrder(
        taskType: TaskType,
    ): Array<{ provider: LlmProvider; model: string }> {
        const prefix =
            taskType === 'complex'
                ? 'COMPLEX_TASK'
                : taskType === 'high_volume'
                  ? 'HIGH_VOLUME_TASK'
                  : 'SIMPLE_TASK';
        const providerConfig =
            this.configService.get<string>(`${prefix}_PROVIDER`) ??
            (taskType === 'complex' ? 'anthropic,deepseek,ollama' : taskType === 'high_volume' ? 'ollama' : 'ollama,anthropic');
        const modelConfig = this.configService.get<string>(`${prefix}_MODEL`);
        return this.parseProviderList(providerConfig, modelConfig);
    }

    private parseProviderList(
        providerConfig: string,
        modelConfig?: string,
    ): Array<{ provider: LlmProvider; model: string }> {
        const providers = providerConfig.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
        const models = (modelConfig ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        const providerMap: Record<string, LlmProvider> = {
            ollama: this.ollamaProvider,
            anthropic: this.anthropicProvider,
            claude: this.anthropicProvider,
            deepseek: this.deepSeekProvider,
        };
        const defaultModels: Record<string, string> = {
            ollama: this.configService.get<string>('OLLAMA_MODEL') ?? 'llama3.1:8b',
            anthropic: this.configService.get<string>('ANTHROPIC_MODEL') ?? 'claude-opus-4-6',
            claude: this.configService.get<string>('ANTHROPIC_MODEL') ?? 'claude-opus-4-6',
            deepseek: this.configService.get<string>('DEEPSEEK_MODEL') ?? 'deepseek-chat',
        };
        const result: Array<{ provider: LlmProvider; model: string }> = [];
        for (let i = 0; i < providers.length; i++) {
            const name = providers[i];
            const p = providerMap[name];
            if (!p) continue;
            if (p !== this.ollamaProvider && !(p as { isAvailable?: () => boolean }).isAvailable?.()) continue;
            const model = models[i] || defaultModels[name];
            result.push({ provider: p, model });
        }
        const ollamaDefault = defaultModels.ollama;
        return result.length > 0 ? result : [{ provider: this.ollamaProvider, model: ollamaDefault }];
    }

    async routeTask(userPrompt: string, schema: any): Promise<any> {
        if (schema.isEmpty) {
            return { action: 'answer', reply: 'The workbook has no data.' };
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

        const buildSheetBlock = (s: { name: string; fullRangeAddress: string; rowCount: number; columnCount: number; headers: string[] }) => {
            const startColMatch = s.fullRangeAddress?.match(/([A-Z]+)\d+/);
            const startColLetter = startColMatch ? startColMatch[1] : 'A';
            const startColIndex = getColumnIndex(startColLetter);
            const headerMapping = (s.headers ?? []).map((header: string, index: number) => {
                return `  Column ${getColumnLetter(startColIndex + index)}: "${header}"`;
            }).join('\n');
            return `Sheet "${s.name}" Range=${s.fullRangeAddress} Rows=${s.rowCount} Cols=${s.columnCount}\n${headerMapping}`;
        };

        const sheets = schema.sheets ?? (schema.sheetName ? [{
            name: schema.sheetName,
            fullRangeAddress: schema.fullRangeAddress,
            rowCount: schema.rowCount,
            columnCount: schema.columnCount,
            headers: schema.headers ?? [],
        }] : []);
        const sheetNames = sheets.map((s: { name: string }) => s.name).join(', ');
        const schemaBlock = sheets.map((s: { name: string; fullRangeAddress: string; rowCount: number; columnCount: number; headers: string[] }) =>
            buildSheetBlock(s)
        ).join('\n\n');
        const activeSheetName = schema.activeSheetName ?? schema.sheetName ?? (sheets[0]?.name ?? '');

        const systemPrompt = `Route this Excel query. Respond with valid JSON only, no other text.

Available worksheets: ${sheetNames}
Active worksheet: ${activeSheetName}

Per-sheet schema:
${schemaBlock}

CRITICAL — MULTI-SHEET REQUIRED when user mentions sheet names:
- "các sheet detail", "sheet detail", "detail sheets", "tất cả sheet detail" → MUST return {"action":"fetch_all","sheets":["<each sheet whose name contains 'detail'>"]}
- "sheets X", "sheet X", "trong sheet X" → include "sheets" array with EXACT names from "Available worksheets" that match (case-insensitive substring).
- If user asks for data from named sheets, NEVER return plain {"action":"fetch_all"} — always include "sheets" with the matching sheet names.

Routing rules:
1. "fetch" — ONLY when user asks for specific row(s). Include "sheet" if requested.
2. "search" — Lookup by column value. Include "sheet" if requested.
3. "fetch_all" with "sheets" — When user mentions sheet names/patterns (detail, summary, etc.). Return sheets array.
4. "fetch_all" without sheets — ONLY when user does NOT mention any sheet name; use active sheet only.

Output format (MUST include "sheets" when user asks for specific sheets):
{"action":"fetch_all","sheets":["Detail1","Detail2"]}
{"action":"fetch_all"}
{"action":"fetch","sheet":"Detail1","range":"A1:E10"}
{"action":"search","sheet":"Detail1","column":"Name","value":"John"}`;

        const routerUserPrompt = `User Question: ${userPrompt}\n\nAgent Output:`;

        const routerProvider = this.configService.get<string>('ROUTER_PROVIDER')?.toLowerCase() ?? 'ollama';
        const routerModel = this.configService.get<string>('ROUTER_MODEL')?.trim() || undefined;

        const providerAndModel = this.getRouterProviderAndModel(routerProvider, routerModel);
        this.logger.log(
            `[ROUTER_REQUEST] provider=${providerAndModel.provider.name} | model=${providerAndModel.model} | prompt="${userPrompt.slice(0, 80)}..." | schema.rows=${schema.rowCount}`,
        );

        const fallbackOrder = providerAndModel.fallback;
        for (const { provider, model } of fallbackOrder) {
            try {
                const textResponse = await provider.chat(
                    systemPrompt,
                    routerUserPrompt,
                    '',
                    model,
                );
                this.logger.log(`[ROUTER_RESPONSE] provider=${provider.name} | output=${JSON.stringify(textResponse)}`);

                const parsed = this.parseRouterOutput(textResponse);
                if (parsed) {
                    const enriched = this.enrichFetchAllWithSheets(parsed, userPrompt, schema);
                    return enriched;
                }
                this.logger.warn(`[ROUTER_FAIL] provider=${provider.name} returned invalid JSON, trying next`);
            } catch (error) {
                this.logger.warn(`[ROUTER_FAIL] provider=${provider.name} failed, trying next`, error);
            }
        }

        this.logger.warn('All router providers failed. Falling back to fetch_all.');
        return { action: 'fetch_all' };
    }

    private getRouterProviderAndModel(
        routerProvider: string,
        routerModel?: string,
    ): {
        provider: LlmProvider;
        model: string;
        fallback: Array<{ provider: LlmProvider; model: string }>;
    } {
        const ollamaModel = routerModel ?? (this.configService.get<string>('OLLAMA_MODEL') ?? 'llama3.1');
        const anthropicModel = routerModel ?? (this.configService.get<string>('ANTHROPIC_MODEL') ?? 'claude-opus-4-6');
        const deepseekModel = routerModel ?? (this.configService.get<string>('DEEPSEEK_MODEL') ?? 'deepseek-chat');

        const ollamaEntry = { provider: this.ollamaProvider, model: ollamaModel };

        switch (routerProvider) {
            case 'anthropic':
                return {
                    provider: this.anthropicProvider,
                    model: anthropicModel,
                    fallback: this.anthropicProvider.isAvailable?.()
                        ? [
                            { provider: this.anthropicProvider, model: anthropicModel },
                            ollamaEntry,
                        ]
                        : [ollamaEntry],
                };
            case 'deepseek':
                return {
                    provider: this.deepSeekProvider,
                    model: deepseekModel,
                    fallback: this.deepSeekProvider.isAvailable?.()
                        ? [
                            { provider: this.deepSeekProvider, model: deepseekModel },
                            ollamaEntry,
                        ]
                        : [ollamaEntry],
                };
            default:
                return {
                    provider: this.ollamaProvider,
                    model: ollamaModel,
                    fallback: [ollamaEntry],
                };
        }
    }

    private enrichFetchAllWithSheets(
        parsed: Record<string, unknown>,
        userPrompt: string,
        schema: any,
    ): Record<string, unknown> {
        if (parsed.action !== 'fetch_all') return parsed;
        if (Array.isArray(parsed.sheets) && parsed.sheets.length > 0) return parsed;
        const sheetList = schema.sheets ?? (schema.sheetName ? [schema] : []);
        if (sheetList.length < 2) return parsed;
        const multiSheetKeywords = /\b(các\s+sheet|sheet\s+detail|detail\s+sheet|sheets?\s+names?|tất\s+cả\s+sheet|all\s+sheets?)\b/i;
        if (!multiSheetKeywords.test(userPrompt)) return parsed;
        const stopwords = new Set(['các', 'sheet', 'sheets', 'cho', 'tôi', 'the', 'all', 'tất', 'cả', 'names', 'named']);
        const words = userPrompt.match(/\b[\wàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+\b/gi) ?? [];
        const keywords = words.filter((w) => w.length >= 2 && !stopwords.has(w.toLowerCase()));
        if (keywords.length === 0) return parsed;
        const matched = sheetList.filter((s: { name: string }) =>
            keywords.some((k) => s.name.toLowerCase().includes(k.toLowerCase())),
        );
        if (matched.length === 0) return parsed;
        const sheetNames = matched.map((s: { name: string }) => s.name);
        this.logger.log(`[ROUTER_ENRICH] prompt mentions multi-sheet, inferring sheets=${sheetNames.join(',')}`);
        return { ...parsed, sheets: sheetNames };
    }

    private parseRouterOutput(textResponse: string): Record<string, unknown> | null {
        let cleaned = textResponse.trim();
        const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) cleaned = jsonMatch[1].trim();
        try {
            return JSON.parse(cleaned) as Record<string, unknown>;
        } catch {
            return null;
        }
    }
}
