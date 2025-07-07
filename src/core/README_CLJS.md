# Agent.ts to ClojureScript Translation

This directory contains the ClojureScript translation of the TypeScript Agent implementation.

## Files

- `agent.cljs` - Main agent implementation
- `memory.cljs` - Memory management for storing conversation history
- `agent_example.cljs` - Usage examples and demonstrations

## Key Differences from TypeScript Version

### 1. Data Structures
- **TypeScript**: Uses classes and interfaces
- **ClojureScript**: Uses records and protocols
- **TypeScript**: Mutable arrays and objects
- **ClojureScript**: Immutable data structures with atoms for state management

### 2. Async Programming
- **TypeScript**: async/await pattern
- **ClojureScript**: core.async with go blocks and channels

### 3. Error Handling
- **TypeScript**: try/catch blocks
- **ClojureScript**: try/catch with go blocks

### 4. JavaScript Interop
- **TypeScript**: Direct property access
- **ClojureScript**: Property access with `.-` and function calls with `.`

## Usage

### Basic Agent Setup

```clojure
(ns my-app
  (:require [agent :as ag]
            [cljs.core.async :refer [go <!]]))

;; Create configuration
(def config (ag/create-agent-config
             model      ; Your AI model
             \"You are a helpful assistant\"  ; System prompt
             tools      ; Tool definitions
             0.7))      ; Temperature

;; Create agent
(def my-agent (ag/create-agent config))

;; Initialize
(go (<! (.initialize my-agent)))
```

### Custom Observer

```clojure
(defrecord MyObserver [state]
  ag/AgentObserver
  (on-stream-text-reset [this]
    (reset! state \"\"))
  
  (on-stream-text [this text]
    (swap! state str text))
  
  (on-finish [this reason]
    (println \"Finished:\" reason))
  
  (on-finish-step [this step]
    (println \"Step completed\")))
```

### Running the Agent

```clojure
(go
  (let [observer (->MyObserver (atom \"\"))]
    (<! (.run my-agent \"Hello!\" observer))
    (.close my-agent)))
```

## Dependencies

You'll need to include these dependencies in your ClojureScript project:

```clojure
;; In deps.edn or project.clj
{:dependencies [[org.clojure/clojure \"1.11.1\"]
                [org.clojure/clojurescript \"1.11.60\"]
                [org.clojure/core.async \"1.6.681\"]]}
```

## JavaScript Modules

The code assumes these JavaScript modules are available:
- `\"ai\"` - The AI library (Vercel AI SDK)
- `\"crypto\"` - For UUID generation
- `\"fs\"` - Node.js file system (promises)
- `\"path\"` - Node.js path utilities

## Key Features Preserved

1. **Message Management**: Full conversation history with persistence
2. **Streaming**: Real-time text streaming with observer pattern
3. **Tool Calling**: Support for function/tool calls
4. **Error Handling**: Comprehensive error management
5. **Memory Persistence**: JSONL file-based storage
6. **Async Operations**: Non-blocking operations using core.async

## Functional Programming Benefits

The ClojureScript version provides several advantages:

1. **Immutability**: Safer concurrent operations
2. **Pure Functions**: Easier testing and reasoning
3. **Composability**: Better function composition
4. **REPL-Driven Development**: Interactive development experience
5. **Macro System**: Code generation capabilities

## Migration Notes

When migrating from the TypeScript version:

1. Replace class instantiation with record creation
2. Convert async/await to go/<!
3. Use atoms for mutable state
4. Implement protocols instead of interfaces
5. Use ClojureScript's JavaScript interop syntax

## Example Project Structure

```
src/
├── agent.cljs
├── memory.cljs
├── config.cljs          ; Configuration management
├── agent_example.cljs   ; Usage examples
└── core.cljs           ; Main application entry point
```

This translation maintains the same functionality as the original TypeScript implementation while leveraging ClojureScript's functional programming paradigms.