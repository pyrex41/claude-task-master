# Task Master Go Port - Product Requirements Document

## Executive Summary

Task Master is a powerful AI-driven task management CLI with sophisticated features for ambitious development workflows. The current TypeScript/Node.js implementation (~37,000 LOC) suffers from startup overhead (500-1000ms) despite recent Bun optimization efforts (~500ms). This PRD outlines a complete rewrite in Go to achieve sub-200ms startup time, reduced memory footprint, and simplified distribution while maintaining 100% feature compatibility.

**Decision: Go** - Chosen for optimal balance of development velocity (4-6 weeks to MVP), ecosystem maturity (official AI provider SDKs, MCP SDK), cross-platform distribution simplicity, and performance (10-20x faster than Node.js).

## Goals & Success Metrics

### Performance Targets
- **Startup time**: Sub-200ms for common commands (list, show, next)
- **Memory usage**: <50MB RSS for typical operations (vs ~150MB Node.js)
- **Binary size**: 8-15MB standalone executable
- **Build time**: <5 seconds for development builds

### Functional Goals
- **Feature parity**: All core commands from TypeScript version
- **AI compatibility**: Support same 12+ AI providers
- **MCP compatibility**: Drop-in replacement for Claude Code integration
- **Data compatibility**: Read/write same JSON format for seamless migration

### Timeline
- **MVP**: 6 weeks from start
- **Phase 1** (Core Foundation): Weeks 1-2
- **Phase 2** (AI Integration): Weeks 2-4
- **Phase 3** (MCP Server): Weeks 4-5
- **Phase 4** (Polish): Weeks 5-6

## Why Go?

### Advantages
1. **Speed to Market**: 4-6 weeks vs 8-12 for Rust
2. **Ecosystem**: Official SDKs for OpenAI, Google Gemini, Anthropic (3rd party)
3. **Simplicity**: Straightforward port from TypeScript concepts
4. **Distribution**: Single binary, trivial cross-compilation
5. **Maintainability**: Easy to onboard contributors, clear idioms
6. **MCP SDK**: Official Go SDK available

### Trade-offs Accepted
- Slightly slower than Rust (but still 10-20x faster than Node.js)
- GC overhead (mitigated by small heap, fast GC cycles)
- Less compile-time safety than Rust (mitigated by testing)

## Architecture Design

### Domain-Driven Design (Port from TypeScript)

```
task-master-go/
├── cmd/
│   ├── task-master/         # CLI entry point
│   └── task-master-mcp/     # MCP server entry point
├── internal/
│   ├── core/                # Business logic (port of @tm/core)
│   │   ├── domain/          # Domain models
│   │   │   ├── tasks/       # Task operations
│   │   │   ├── auth/        # Authentication
│   │   │   ├── workflow/    # Workflow orchestration
│   │   │   ├── git/         # Git integration
│   │   │   └── config/      # Configuration
│   │   ├── storage/         # Storage abstraction
│   │   │   ├── file/        # File-based storage
│   │   │   └── api/         # API storage (future)
│   │   └── ai/              # AI provider abstraction
│   │       ├── provider/    # Provider interface
│   │       ├── anthropic/   # Claude implementation
│   │       ├── openai/      # GPT implementation
│   │       ├── google/      # Gemini implementation
│   │       └── perplexity/  # Research implementation
│   ├── cli/                 # CLI presentation layer
│   │   ├── commands/        # Command implementations
│   │   └── ui/              # TUI components
│   └── mcp/                 # MCP server
│       ├── server/          # MCP protocol handling
│       └── tools/           # MCP tool definitions
├── pkg/                     # Public libraries
│   └── taskmaster/          # Go SDK (future)
├── go.mod
└── go.sum
```

### Key Design Principles
1. **Clean separation**: core (business logic) vs cli/mcp (presentation)
2. **Dependency injection**: Interfaces for storage, AI providers
3. **No globals**: Pass dependencies explicitly
4. **Atomic writes**: Use file locking for concurrent safety
5. **Idiomatic Go**: Embrace Go conventions, not TypeScript patterns

## Phase 1: Core Foundation (Weeks 1-2)

### Week 1: Data Structures & Storage

#### Task Models
```go
type Task struct {
    ID          string     `json:"id"`
    Title       string     `json:"title"`
    Description string     `json:"description"`
    Status      Status     `json:"status"`
    Priority    Priority   `json:"priority"`
    Tags        []string   `json:"tags,omitempty"`
    Dependencies []string  `json:"dependencies,omitempty"`
    Subtasks    []Task     `json:"subtasks,omitempty"`
    Details     string     `json:"details,omitempty"`
    TestStrategy string    `json:"testStrategy,omitempty"`
    CreatedAt   time.Time  `json:"createdAt"`
    UpdatedAt   time.Time  `json:"updatedAt"`
}

type Status string
const (
    StatusPending    Status = "pending"
    StatusInProgress Status = "in-progress"
    StatusDone       Status = "done"
    StatusDeferred   Status = "deferred"
    StatusCancelled  Status = "cancelled"
    StatusBlocked    Status = "blocked"
)

type Priority string
const (
    PriorityLow      Priority = "low"
    PriorityMedium   Priority = "medium"
    PriorityHigh     Priority = "high"
    PriorityCritical Priority = "critical"
)
```

#### Storage Interface
```go
type Storage interface {
    LoadTasks(tag string) ([]Task, error)
    SaveTasks(tag string, tasks []Task) error
    GetConfig() (*Config, error)
    SaveConfig(config *Config) error
    ListTags() ([]string, error)
}

type FileStorage struct {
    basePath string
    mu       sync.RWMutex
}

// Atomic writes with temp file + rename
func (fs *FileStorage) SaveTasks(tag string, tasks []Task) error {
    // Marshal JSON
    // Write to temp file
    // fsync()
    // Rename to target (atomic on POSIX)
}
```

#### CLI Framework
```go
// Using cobra (standard in kubectl, hugo, etc.)
import "github.com/spf13/cobra"

var rootCmd = &cobra.Command{
    Use:   "task-master",
    Short: "AI-driven task management",
}

var listCmd = &cobra.Command{
    Use:   "list",
    Short: "List tasks",
    Run:   runList,
}
```

#### Commands to Implement
- `init` - Initialize .taskmaster directory
- `list` - List tasks with filtering
- `show <id>` - Show task details
- `add-task` - Add task (non-AI version)
- `remove-task` - Delete task
- `set-status` - Update task status
- `tags` - List tags
- `use-tag` - Switch active tag

#### Dependencies
```go
require (
    github.com/spf13/cobra v1.8.0
    github.com/fatih/color v1.16.0
    github.com/olekukonko/tablewriter v0.0.5
)
```

#### Success Criteria
- All basic CRUD operations working
- JSON compatibility with TypeScript version
- Sub-100ms for `list` on 100 tasks
- Atomic writes prevent corruption
- Works on macOS, Linux, Windows

### Week 2: Task Operations & Utilities

#### Task Querying
```go
type TaskFilter struct {
    Status   *Status
    Priority *Priority
    Tag      string
    HasDeps  bool
}

func (d *TasksDomain) Filter(filter TaskFilter) []Task
func (d *TasksDomain) GetByID(id string) (*Task, error)  // Supports "1", "1.2", "1.2.3"
func (d *TasksDomain) GetNext() (*Task, error)           // Find next available task
```

#### Dependency Management
```go
func (d *TasksDomain) AddDependency(taskID, dependsOn string) error
func (d *TasksDomain) ValidateDependencies() []ValidationError
func (d *TasksDomain) FixDependencies() ([]string, error)  // Auto-fix cycles
```

#### Markdown Generation
```go
func (d *TasksDomain) GenerateMarkdown() error {
    // Generate .taskmaster/tasks/task-*.md files
    // Mirror TypeScript implementation
}
```

#### Commands to Implement
- `next` - Find next available task
- `add-dependency` - Add task dependency
- `remove-dependency` - Remove dependency
- `validate-dependencies` - Check for cycles
- `fix-dependencies` - Auto-fix issues
- `generate` - Generate markdown files
- `move` - Reorganize task hierarchy

#### Success Criteria
- Dependency validation detects cycles
- Task ID parsing supports all formats (1, 1.2, 1.2.3)
- `next` returns correct task based on status/deps
- Markdown output matches TypeScript version

## Phase 2: AI Integration (Weeks 2-4)

### Week 2-3: AI Provider Abstraction

#### Unified AI Interface
```go
type AIProvider interface {
    // Generate text response
    Generate(ctx context.Context, req GenerateRequest) (*GenerateResponse, error)

    // Stream response chunks
    GenerateStream(ctx context.Context, req GenerateRequest) (<-chan string, error)

    // Generate structured output (JSON mode)
    GenerateStructured(ctx context.Context, req GenerateRequest, schema any) (any, error)

    // Get model info
    GetModel() string
    GetProvider() string
}

type GenerateRequest struct {
    Prompt      string
    SystemPrompt string
    MaxTokens   int
    Temperature float64
    Schema      any  // For structured outputs
}

type GenerateResponse struct {
    Content string
    Usage   Usage
}

type Usage struct {
    PromptTokens     int
    CompletionTokens int
    TotalTokens      int
}
```

#### Provider Implementations

**Anthropic (Claude)**
```go
import "github.com/anthropics/anthropic-sdk-go"

type AnthropicProvider struct {
    client *anthropic.Client
    model  string
}

func (p *AnthropicProvider) Generate(ctx context.Context, req GenerateRequest) (*GenerateResponse, error) {
    resp, err := p.client.Messages.New(ctx, anthropic.MessageNewParams{
        Model:       anthropic.F(p.model),
        MaxTokens:   anthropic.F(int64(req.MaxTokens)),
        Temperature: anthropic.F(req.Temperature),
        Messages: []anthropic.MessageParam{
            anthropic.NewUserMessage(anthropic.NewTextBlock(req.Prompt)),
        },
    })
    // Handle response
}

// Implement streaming
func (p *AnthropicProvider) GenerateStream(ctx context.Context, req GenerateRequest) (<-chan string, error) {
    stream := p.client.Messages.NewStreaming(ctx, params)
    ch := make(chan string)
    go func() {
        defer close(ch)
        for stream.Next() {
            event := stream.Current()
            if delta, ok := event.Delta.(anthropic.ContentBlockDeltaEventDelta); ok {
                ch <- delta.Text
            }
        }
    }()
    return ch, nil
}
```

**OpenAI (GPT)**
```go
import "github.com/openai/openai-go"

type OpenAIProvider struct {
    client *openai.Client
    model  string
}

func (p *OpenAIProvider) Generate(ctx context.Context, req GenerateRequest) (*GenerateResponse, error) {
    resp, err := p.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
        Model: openai.F(p.model),
        Messages: openai.F([]openai.ChatCompletionMessageParamUnion{
            openai.UserMessage(req.Prompt),
        }),
    })
    // Handle response
}

// JSON mode for structured outputs
func (p *OpenAIProvider) GenerateStructured(ctx context.Context, req GenerateRequest, schema any) (any, error) {
    resp, err := p.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
        Model: openai.F(p.model),
        Messages: openai.F([]openai.ChatCompletionMessageParamUnion{
            openai.UserMessage(req.Prompt),
        }),
        ResponseFormat: openai.F(openai.ChatCompletionNewParamsResponseFormatJSONSchema{
            Type: openai.F(openai.ChatCompletionNewParamsResponseFormatJSONSchemaTypeJSONSchema),
            JSONSchema: openai.F(openai.ChatCompletionNewParamsResponseFormatJSONSchemaJSONSchema{
                Name:   openai.F("task_response"),
                Schema: schema,
            }),
        }),
    })
    // Parse JSON response into schema type
}
```

**Google (Gemini)**
```go
import "github.com/google/generative-ai-go/genai"

type GoogleProvider struct {
    client *genai.Client
    model  string
}

func (p *GoogleProvider) Generate(ctx context.Context, req GenerateRequest) (*GenerateResponse, error) {
    model := p.client.GenerativeModel(p.model)
    model.SetTemperature(float32(req.Temperature))
    model.SetMaxOutputTokens(int32(req.MaxTokens))

    resp, err := model.GenerateContent(ctx, genai.Text(req.Prompt))
    // Handle response
}
```

**Perplexity (Research)**
```go
// Use OpenAI-compatible API
type PerplexityProvider struct {
    client *openai.Client  // Configured with Perplexity base URL
    model  string
}
```

#### Provider Registry
```go
type ProviderRegistry struct {
    providers map[string]AIProvider
}

func NewProviderRegistry(config *Config) (*ProviderRegistry, error) {
    registry := &ProviderRegistry{
        providers: make(map[string]AIProvider),
    }

    // Register providers based on API keys
    if config.AnthropicAPIKey != "" {
        registry.providers["claude-3-5-sonnet-20241022"] = NewAnthropicProvider(
            config.AnthropicAPIKey,
            "claude-3-5-sonnet-20241022",
        )
    }

    if config.OpenAIAPIKey != "" {
        registry.providers["gpt-4o"] = NewOpenAIProvider(
            config.OpenAIAPIKey,
            "gpt-4o",
        )
    }

    // ... register other providers

    return registry, nil
}

func (r *ProviderRegistry) Get(model string) (AIProvider, error) {
    provider, ok := r.providers[model]
    if !ok {
        return nil, fmt.Errorf("provider not found for model: %s", model)
    }
    return provider, nil
}
```

#### Dependencies
```go
require (
    github.com/anthropics/anthropic-sdk-go v0.1.0
    github.com/openai/openai-go v0.1.0
    github.com/google/generative-ai-go v0.5.0
)
```

### Week 3-4: AI-Powered Commands

#### PRD Parsing
```go
type PRDParser struct {
    provider AIProvider
}

func (p *PRDParser) Parse(ctx context.Context, prdContent string, append bool) ([]Task, error) {
    prompt := buildPRDPrompt(prdContent)

    schema := TaskListSchema  // JSON schema for task array

    resp, err := p.provider.GenerateStructured(ctx, GenerateRequest{
        Prompt:      prompt,
        SystemPrompt: "You are an expert at breaking down product requirements into actionable tasks.",
        MaxTokens:   8000,
        Temperature: 0.3,
        Schema:      schema,
    }, schema)

    // Parse response into []Task
    tasks := parseTasksFromJSON(resp)

    return tasks, nil
}
```

#### Task Expansion
```go
func (d *TasksDomain) ExpandTask(ctx context.Context, taskID string, force bool, research bool) error {
    task, err := d.GetByID(taskID)

    var provider AIProvider
    if research {
        provider = d.registry.Get(d.config.ResearchModel)  // Perplexity
    } else {
        provider = d.registry.Get(d.config.MainModel)
    }

    prompt := fmt.Sprintf("Break down this task into 3-7 subtasks:\n\nTitle: %s\nDescription: %s",
        task.Title, task.Description)

    schema := SubtaskListSchema

    resp, err := provider.GenerateStructured(ctx, GenerateRequest{
        Prompt: prompt,
        MaxTokens: 4000,
        Schema: schema,
    }, schema)

    subtasks := parseSubtasksFromJSON(resp)
    task.Subtasks = subtasks

    return d.storage.SaveTasks(d.config.CurrentTag, d.tasks)
}
```

#### Task Updates
```go
func (d *TasksDomain) UpdateTask(ctx context.Context, taskID, updatePrompt string) error {
    task, err := d.GetByID(taskID)

    provider := d.registry.Get(d.config.MainModel)

    prompt := fmt.Sprintf("Update this task based on the following request:\n\nCurrent:\n%s\n\nUpdate: %s",
        taskToString(task), updatePrompt)

    schema := TaskUpdateSchema

    resp, err := provider.GenerateStructured(ctx, GenerateRequest{
        Prompt: prompt,
        MaxTokens: 2000,
        Schema: schema,
    }, schema)

    applyUpdates(task, resp)

    return d.storage.SaveTasks(d.config.CurrentTag, d.tasks)
}
```

#### Commands to Implement
- `parse-prd` - Generate tasks from PRD
- `expand` - Break task into subtasks (AI)
- `expand --all` - Expand all eligible tasks
- `add-task --prompt` - Add task with AI assistance
- `update-task` - Update single task (AI)
- `update` - Update multiple tasks (AI)
- `update-subtask` - Add implementation notes (AI)
- `models` - Configure AI models
- `models --setup` - Interactive setup

#### Success Criteria
- PRD parsing produces same task structure as TypeScript version
- Task expansion generates quality subtasks
- Structured outputs consistently parse to valid JSON
- Error handling for API failures (retry logic)
- Streaming works for long responses

## Phase 3: MCP Server (Weeks 4-5)

### MCP Protocol Integration

#### Using Official Go SDK
```go
import "github.com/modelcontextprotocol/go-sdk/server"

type TaskMasterMCPServer struct {
    core *core.TmCore
}

func (s *TaskMasterMCPServer) ListTools() []server.Tool {
    return []server.Tool{
        {
            Name: "get_tasks",
            Description: "List all tasks with optional filtering",
            InputSchema: map[string]any{
                "type": "object",
                "properties": map[string]any{
                    "status": {"type": "string", "enum": []string{"pending", "in-progress", "done"}},
                    "tag": {"type": "string"},
                },
            },
        },
        {
            Name: "get_task",
            Description: "Get detailed information about a specific task",
            InputSchema: map[string]any{
                "type": "object",
                "properties": map[string]any{
                    "id": {"type": "string", "description": "Task ID (e.g., '1', '1.2', '1.2.3')"},
                },
                "required": []string{"id"},
            },
        },
        {
            Name: "set_task_status",
            Description: "Update task status",
            InputSchema: map[string]any{
                "type": "object",
                "properties": map[string]any{
                    "id": {"type": "string"},
                    "status": {"type": "string", "enum": []string{"pending", "in-progress", "done", "deferred", "cancelled", "blocked"}},
                },
                "required": []string{"id", "status"},
            },
        },
        // ... other tools
    }
}

func (s *TaskMasterMCPServer) CallTool(ctx context.Context, name string, arguments map[string]any) (any, error) {
    switch name {
    case "get_tasks":
        return s.handleGetTasks(ctx, arguments)
    case "get_task":
        return s.handleGetTask(ctx, arguments)
    case "set_task_status":
        return s.handleSetTaskStatus(ctx, arguments)
    // ... other tools
    default:
        return nil, fmt.Errorf("unknown tool: %s", name)
    }
}

func (s *TaskMasterMCPServer) handleGetTasks(ctx context.Context, args map[string]any) (any, error) {
    filter := TaskFilter{}

    if status, ok := args["status"].(string); ok {
        s := Status(status)
        filter.Status = &s
    }

    if tag, ok := args["tag"].(string); ok {
        filter.Tag = tag
    }

    tasks, err := s.core.Tasks.List(filter)
    if err != nil {
        return nil, err
    }

    return map[string]any{
        "tasks": tasks,
        "count": len(tasks),
    }, nil
}
```

#### MCP Tools to Implement
- `help` - Show available commands
- `initialize_project` - Init .taskmaster
- `parse_prd` - Parse PRD document
- `get_tasks` - List tasks
- `next_task` - Get next task
- `get_task` - Show task details
- `set_task_status` - Update status
- `add_task` - Add new task
- `expand_task` - Expand into subtasks
- `update_task` - Update task (AI)
- `update_subtask` - Update subtask (AI)
- `update` - Update multiple tasks
- `analyze_project_complexity` - Analyze complexity
- `complexity_report` - View report

#### Server Entry Point
```go
// cmd/task-master-mcp/main.go
func main() {
    // Load config
    config, err := loadConfig()

    // Initialize core
    core, err := core.NewTmCore(config)

    // Create MCP server
    mcpServer := mcp.NewTaskMasterMCPServer(core)

    // Start stdio transport
    server.ServeStdio(mcpServer)
}
```

#### Dependencies
```go
require (
    github.com/modelcontextprotocol/go-sdk v0.1.0
)
```

#### Success Criteria
- MCP server works with Claude Code
- All tools return correct JSON responses
- Error messages are helpful
- Compatible with .mcp.json configuration
- Streams work for AI commands (parse-prd, expand)

## Phase 4: Polish (Weeks 5-6)

### Week 5: Interactive UI & Git

#### Interactive Prompts
```go
import (
    "github.com/AlecAivazis/survey/v2"
    "github.com/pterm/pterm"
)

// Model selection
func selectModel(models []string) (string, error) {
    var selected string
    prompt := &survey.Select{
        Message: "Choose AI model:",
        Options: models,
    }
    survey.AskOne(prompt, &selected)
    return selected, nil
}

// Confirmation
func confirm(message string) (bool, error) {
    var result bool
    prompt := &survey.Confirm{
        Message: message,
    }
    survey.AskOne(prompt, &result)
    return result, nil
}

// Progress spinner
func withSpinner(message string, fn func() error) error {
    spinner, _ := pterm.DefaultSpinner.Start(message)
    err := fn()
    if err != nil {
        spinner.Fail()
    } else {
        spinner.Success()
    }
    return err
}
```

#### Git Integration
```go
import "github.com/go-git/go-git/v5"

type GitService struct {
    repo *git.Repository
}

func (g *GitService) IsRepo() bool {
    _, err := git.PlainOpen(".")
    return err == nil
}

func (g *GitService) GetBranch() (string, error) {
    repo, err := git.PlainOpen(".")
    head, err := repo.Head()
    return head.Name().Short(), nil
}

func (g *GitService) Commit(message string, files []string) error {
    repo, err := git.PlainOpen(".")
    w, err := repo.Worktree()

    for _, file := range files {
        w.Add(file)
    }

    _, err = w.Commit(message, &git.CommitOptions{})
    return err
}
```

#### Pretty Output
```go
import "github.com/olekukonko/tablewriter"

func printTaskTable(tasks []Task) {
    table := tablewriter.NewWriter(os.Stdout)
    table.SetHeader([]string{"ID", "Title", "Status", "Priority"})

    for _, task := range tasks {
        table.Append([]string{
            task.ID,
            truncate(task.Title, 50),
            string(task.Status),
            string(task.Priority),
        })
    }

    table.Render()
}
```

#### Commands to Implement
- `models --setup` - Interactive model setup
- Pretty table output for `list`
- Colored status indicators
- Progress spinners for AI operations
- Git integration for `context` command

### Week 6: Migration & Final Features

#### Migration Tool
```go
func migrate() error {
    // Detect old task format
    // Convert to new format
    // Backup old files
    // Write new files

    pterm.Success.Println("Migration complete!")
    pterm.Info.Printfln("Backup saved to: .taskmaster/backup-YYYY-MM-DD")

    return nil
}
```

#### Complexity Analysis
```go
type ComplexityAnalyzer struct {
    provider AIProvider
}

func (c *ComplexityAnalyzer) Analyze(ctx context.Context, tasks []Task) (*ComplexityReport, error) {
    prompt := buildComplexityPrompt(tasks)

    resp, err := c.provider.GenerateStructured(ctx, GenerateRequest{
        Prompt: prompt,
        MaxTokens: 8000,
    }, ComplexityReportSchema)

    return parseComplexityReport(resp), nil
}
```

#### Commands to Implement
- `migrate` - Migrate from TypeScript version
- `analyze-complexity` - Analyze task complexity (AI)
- `complexity-report` - View complexity report
- `scope-up` - Increase task scope
- `scope-down` - Decrease task scope
- `research` - Research-enhanced operations
- `lang` - Set response language
- `rules` - Manage AI behavior rules

#### Success Criteria
- TypeScript→Go migration works seamlessly
- All original commands ported
- Performance meets targets (<200ms startup)
- Binary size <15MB
- Works on macOS, Linux, Windows

## Technical Specifications

### Language & Runtime
- **Go version**: 1.21+ (for better error handling, generics)
- **Module system**: Go modules (go.mod)
- **Build tool**: Standard `go build`

### Dependencies

#### Core
```go
require (
    github.com/spf13/cobra v1.8.0              // CLI framework
    github.com/spf13/viper v1.18.0             // Configuration
    github.com/fatih/color v1.16.0             // Terminal colors
)
```

#### AI Providers
```go
require (
    github.com/anthropics/anthropic-sdk-go v0.1.0
    github.com/openai/openai-go v0.1.0
    github.com/google/generative-ai-go v0.5.0
)
```

#### UI/UX
```go
require (
    github.com/AlecAivazis/survey/v2 v2.3.7    // Interactive prompts
    github.com/pterm/pterm v0.12.79            // Pretty terminal output
    github.com/olekukonko/tablewriter v0.0.5   // ASCII tables
)
```

#### Git
```go
require (
    github.com/go-git/go-git/v5 v5.11.0        // Pure Go git
)
```

#### MCP
```go
require (
    github.com/modelcontextprotocol/go-sdk v0.1.0
)
```

### Build Configuration

#### Development
```bash
go build -o bin/task-master ./cmd/task-master
go build -o bin/task-master-mcp ./cmd/task-master-mcp
```

#### Production
```bash
# Optimized for size and speed
go build -ldflags="-s -w" -trimpath -o bin/task-master ./cmd/task-master
go build -ldflags="-s -w" -trimpath -o bin/task-master-mcp ./cmd/task-master-mcp

# Cross-compile
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -trimpath -o bin/task-master-linux-amd64 ./cmd/task-master
GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -trimpath -o bin/task-master-darwin-amd64 ./cmd/task-master
GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -trimpath -o bin/task-master-darwin-arm64 ./cmd/task-master
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -trimpath -o bin/task-master-windows-amd64.exe ./cmd/task-master
```

#### Binary Size Optimization
```bash
# Use upx for further compression (optional)
upx --best --lzma bin/task-master
# Expected: 15MB → 5MB
```

### Performance Targets

#### Startup Time
- `list` (100 tasks): <100ms
- `show 1.2`: <50ms
- `next`: <80ms
- `set-status --id=1 --status=done`: <60ms

#### Memory Usage
- Idle: <20MB RSS
- List 1000 tasks: <40MB RSS
- AI operation: <80MB RSS

#### AI Operations
- `parse-prd`: 5-30 seconds (API-bound)
- `expand`: 3-10 seconds (API-bound)
- `update-task`: 2-8 seconds (API-bound)

### Cross-Platform Support

#### Supported Platforms
- macOS (Intel & Apple Silicon)
- Linux (x86_64, ARM64)
- Windows (x86_64)

#### Platform-Specific Considerations
- File paths: Use `filepath` package (handles Windows backslashes)
- Line endings: Normalize to LF internally, preserve on write
- Colors: Check terminal support before using ANSI codes
- Home directory: Use `os.UserHomeDir()` (cross-platform)

## Testing Strategy

### Unit Tests
- Core business logic (task operations, dependency validation)
- Task ID parsing (1, 1.2, 1.2.3)
- Storage layer (atomic writes, error handling)
- AI provider abstraction (mocking)

### Integration Tests
- Full command workflows (add → expand → set-status)
- File I/O (read/write tasks.json)
- Git operations
- MCP server (tool calls, responses)

### E2E Tests
- CLI smoke tests with real .taskmaster directory
- Migration from TypeScript version
- AI operations with mocked providers

### Test Coverage Goal
- Core: >80% coverage
- CLI: >60% coverage (exclude UI)
- MCP: >70% coverage

### Testing Tools
```go
require (
    github.com/stretchr/testify v1.8.4  // Assertions, mocking
    github.com/golang/mock v1.6.0       // Mock generation
)
```

## Migration Path

### For Users

#### Option 1: Side-by-side (Recommended)
```bash
# Keep TypeScript version
npm install -g task-master-ai

# Install Go version
brew install task-master-go  # or download binary

# Try it out
task-master-go list

# When ready, alias
alias task-master=task-master-go
```

#### Option 2: Direct replacement
```bash
# Backup TypeScript version
mv /usr/local/bin/task-master /usr/local/bin/task-master-node

# Install Go version
cp task-master-go /usr/local/bin/task-master

# Data is compatible - no migration needed!
task-master list
```

### Data Compatibility

#### JSON Format
- **100% compatible**: Go version reads/writes same tasks.json format
- **No migration needed**: Existing .taskmaster directories work as-is
- **Backwards compatible**: TypeScript version can read Go-written files

#### Configuration
```json
// .taskmaster/config.json - same format
{
  "currentTag": "master",
  "mainModel": "claude-3-5-sonnet-20241022",
  "researchModel": "perplexity-llama-3.1-sonar-large-128k-online",
  "fallbackModel": "gpt-4o-mini",
  "performanceMode": "standard"
}
```

### Deprecation Timeline

#### Phase 1: Soft Launch (Months 1-2)
- Go version available as `task-master-go`
- TypeScript version continues as `task-master`
- Both maintained, bugs fixed

#### Phase 2: Transition (Months 3-4)
- Go version becomes default in installers
- TypeScript version available as `task-master-node`
- New features only in Go version

#### Phase 3: Maintenance (Month 5+)
- Go version is primary
- TypeScript version in maintenance mode (critical bugs only)
- Documentation focuses on Go version

## Risks & Mitigation

### Risk 1: AI SDK Complexity
**Impact**: High
**Probability**: Medium
**Mitigation**:
- Start with 3 providers (Anthropic, OpenAI, Google)
- Use structured outputs from day 1
- Build comprehensive test suite with mocked responses
- Budget 2 weeks for AI abstraction layer

### Risk 2: Feature Parity Gaps
**Impact**: Medium
**Probability**: Medium
**Mitigation**:
- Prioritize MVP features first (Core CRUD + AI + MCP)
- Defer advanced features (Autopilot, Auth) to post-MVP
- Maintain feature compatibility matrix
- Regular testing against TypeScript version

### Risk 3: Performance Expectations
**Impact**: Low
**Probability**: Low
**Mitigation**:
- Conservative targets (sub-200ms vs sub-100ms)
- Benchmark regularly against Node.js baseline
- Profile hot paths (task loading, JSON parsing)
- Go is fast enough even without optimization

### Risk 4: Cross-Platform Issues
**Impact**: Medium
**Probability**: Low
**Mitigation**:
- Test on all platforms early
- Use cross-platform Go libraries (filepath, os)
- CI/CD for automated testing (GitHub Actions)
- Docker for reproducible builds

### Risk 5: MCP Protocol Changes
**Impact**: Medium
**Probability**: Low
**Mitigation**:
- Use official Go SDK (maintained by Anthropic)
- Version pin MCP SDK
- Monitor MCP spec changes
- Maintain test suite for MCP compatibility

## Success Metrics

### Performance (Must Have)
- ✅ Startup <200ms for common commands
- ✅ Memory <50MB for typical operations
- ✅ Binary size 8-15MB

### Functionality (Must Have)
- ✅ All Phase 1-3 features working
- ✅ Data compatible with TypeScript version
- ✅ MCP server works with Claude Code

### Quality (Must Have)
- ✅ >70% test coverage on core
- ✅ Zero data corruption issues
- ✅ Works on macOS, Linux, Windows

### User Experience (Nice to Have)
- ⭐ Pretty output with colors/tables
- ⭐ Helpful error messages
- ⭐ Interactive prompts for setup
- ⭐ Progress indicators for AI operations

## Future Phases (Post-MVP)

### Phase 5: Advanced Features
- Autopilot/TDD workflow (state machine)
- tryhamster.com authentication
- API storage backend
- Workspace context management
- Task templates
- Bulk operations

### Phase 6: Go SDK
- `pkg/taskmaster` - Public Go library
- Embed Task Master in other Go apps
- Programmatic task management

### Phase 7: Performance Optimization
- Parallel task processing
- Task index for O(1) lookups
- Lazy loading for large task sets
- Caching for repeated queries

### Phase 8: Advanced AI
- Multi-model consensus
- Agentic task planning
- Auto-dependency detection
- Smart task prioritization

## Conclusion

This Go port will deliver a lightning-fast, single-binary Task Master with full feature compatibility in 6 weeks. The architecture mirrors the proven TypeScript design while leveraging Go's performance, simplicity, and excellent cross-platform support. By focusing on the MVP (Core CRUD + AI + MCP), we can ship a production-ready tool that makes the TypeScript version obsolete while maintaining a smooth migration path for existing users.

**Timeline**: 6 weeks
**Target**: Sub-200ms startup, <50MB memory, 8-15MB binary
**Compatibility**: 100% data-compatible with TypeScript version
**Distribution**: Single binary, trivial to install and update

The future is Go. Let's build it.
