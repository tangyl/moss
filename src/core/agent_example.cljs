(ns agent-example
  (:require [agent :as ag]
            [cljs.core.async :as async :refer [go <!]]
            [\"ai\" :as ai]))

;; Example usage of the ClojureScript Agent

;; Custom observer implementation
(defrecord CustomObserver [output-atom]
  ag/AgentObserver
  (on-stream-text-reset [this]
    (reset! output-atom \"\")
    (js/console.log \"🔄 Stream reset\"))
  
  (on-stream-text [this text]
    (swap! output-atom str text)
    (js/console.log \"📝 Text:\" text))
  
  (on-finish [this reason]
    (js/console.log \"✅ Finished with reason:\" reason))
  
  (on-finish-step [this step]
    (js/console.log \"🔧 Step completed:\" (.-type step))))

(defn create-custom-observer [output-atom]
  (->CustomObserver output-atom))

;; Example function to create and run an agent
(defn run-agent-example []
  (go
    (try
      ;; Create agent configuration
      (let [config (ag/create-agent-config
                    ;; You would need to provide actual model, tools here
                    nil  ; model (e.g., from OpenAI)
                    \"You are a helpful AI assistant.\"  ; system prompt
                    {}   ; tools
                    0.7) ; temperature
            
            ;; Create agent
            agent (ag/create-agent config)
            
            ;; Create observer with output atom
            output (atom \"\")
            observer (create-custom-observer output)]
        
        ;; Initialize agent
        (<! (.initialize agent))
        
        ;; Run agent with a prompt
        (<! (.run agent \"Hello, how are you?\" observer))
        
        ;; Get final output
        (js/console.log \"Final output:\" @output)
        
        ;; Clean up
        (.close agent))
      
      (catch js/Error error
        (js/console.error \"Error running agent:\" error)))))

;; Function to demonstrate agent history management
(defn history-management-example []
  (go
    (let [config (ag/create-agent-config nil \"Assistant\" {} 0.7)
          agent (ag/create-agent config)]
      
      ;; Initialize
      (<! (.initialize agent))
      
      ;; Load existing history
      (<! (.load-history agent))
      (js/console.log \"History loaded\")
      
      ;; Clear history if needed
      (<! (.clear-history agent))
      (js/console.log \"History cleared\")
      
      ;; Close agent
      (.close agent))))

;; Export main functions
(defn ^:export main []
  (js/console.log \"Starting ClojureScript Agent example...\")
  (run-agent-example))