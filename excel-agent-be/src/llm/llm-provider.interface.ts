export type TaskType = 'complex' | 'high_volume' | 'simple';

export interface LlmProvider {
    chat(
        systemPrompt: string,
        userPrompt: string,
        context: string,
        modelOverride?: string,
    ): Promise<string>;
    readonly name: string;
}
