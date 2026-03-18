# Question Processing Flow

```mermaid
flowchart TB
    subgraph User
        A[User enters question]
    end

    subgraph Frontend["Excel Add-in (taskpane.js)"]
        B[Extract Excel Schema<br/>metadata only: headers, range, rowCount]
        C[POST /chat/route<br/>prompt + schema]
        D{routeData.action?}
        E[fetch]
        F[search]
        G[fetch_all]
        H[answer]
        I[fetchExcelRange<br/>range]
        J[searchExcelData<br/>column, value]
        K[fetchExcelRange<br/>fullRangeAddress]
        L[Display reply<br/>Skip chat API]
        M[Build finalContext<br/>Active Worksheet + data]
        N[POST /chat<br/>prompt + context + schema]
    end

    subgraph Backend["NestJS Backend"]
        subgraph Router["/chat/route"]
            O{schema.isEmpty?}
            P[Return action: answer<br/>reply: 'Sheet is empty']
            Q[Ollama Router LLM<br/>JSON: fetch/search/fetch_all]
        end

        subgraph AnswerAgent["/chat"]
            R[ClassifierService<br/>heuristic: simple/complex/high_volume]
            S[Select provider<br/>Ollama / DeepSeek]
            T[LLM chat<br/>systemPrompt + userPrompt + context]
            U[Return reply, model_used]
        end
    end

    A --> B --> C
    C --> O
    O -->|yes| P
    O -->|no| Q
    P --> D
    Q --> D

    D -->|fetch + range| E --> I
    D -->|search + column, value| F --> J
    D -->|fetch_all| G --> K
    D -->|answer + reply| H --> L

    I --> M
    J --> M
    K --> M

    M --> N
    N --> R --> S --> T --> U
    U --> V[Display reply + model]
    L --> V
```

## Flow Summary

| Step | Component | Action |
|------|-----------|--------|
| 1 | Frontend | User sends question; extract schema (headers, range, rowCount) |
| 2 | Frontend | POST to `/chat/route` with prompt + schema |
| 3 | Backend Router | If sheet empty → return `{ action: 'answer', reply }` |
| 4 | Backend Router | Else → Ollama Router LLM returns JSON: `fetch` / `search` / `fetch_all` |
| 5 | Frontend | Fetch data: `fetchExcelRange(range)` or `searchExcelData(col, val)` or full range |
| 6 | Frontend | If `answer` → display reply and stop |
| 7 | Frontend | Else → POST to `/chat` with prompt + context + schema |
| 8 | Backend Answer | Classifier assigns task type (simple/complex/high_volume) |
| 9 | Backend Answer | Select LLM (Ollama / DeepSeek); call `chat()` |
| 10 | Frontend | Display reply and model used |
