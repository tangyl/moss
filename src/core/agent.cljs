(ns agent
  (:require [clojure.string :as str]
            [cljs.core.async :as async :refer [go <!]]
            [memory :as mem]
            ["ai" :as ai]
            ["crypto" :as crypto]))

;; Agent configuration record
(defrecord AgentConfig [model system tools temperature])

;; Agent observer protocol
(defprotocol AgentObserver
  (on-stream-text-reset [this] "Called when stream text is reset")
  (on-stream-text [this text] "Called when new text is streamed")
  (on-finish [this reason] "Called when agent finishes")
  (on-finish-step [this step] "Called when a step finishes"))

;; Agent class
(defrecord Agent [config messages memory]
  Object
  (initialize [this]
    (go
      (<! (mem/init-database memory))
      (<! (.load-history this))))

  (run [this prompt observer]
    (go
      (let [user-message {:id (-> (crypto/randomUUID)
                                  (.slice 0 8))
                          :role "user"
                          :content prompt}]
        ;; Add user message to messages and save to memory
        (swap! (:messages this) conj user-message)
        (<! (mem/save-message memory user-message))
        
        (loop [break-loop false]
          (when-not break-loop
            (let [result (<! (ai/streamText
                              (clj->js
                               {:model (:model config)
                                :system (:system config)
                                :messages @(:messages this)
                                :maxTokens 32000
                                :temperature (:temperature config)
                                :topP 1
                                :frequencyPenalty 0
                                :presencePenalty 0
                                :stopSequences []
                                :maxSteps 1
                                :tools (:tools config)
                                :onStepFinish (fn [step]
                                                (go
                                                  (doseq [message (.-messages (.-response step))]
                                                    (let [msg (js->clj message :keywordize-keys true)]
                                                      (swap! (:messages this) conj msg)
                                                      (<! (mem/save-message memory msg))))
                                                  (on-finish-step observer step)))
                                :onError (fn [error]
                                           (set! break-loop true)
                                           (js/console.error error)
                                           (js/console.log "!!!Error!!!")
                                           (js/console.log error)
                                           (js/console.log 
                                            (js/JSON.stringify 
                                             (.-requestBodyValues (.-error error)) 
                                             nil 2)))})))]
              
              ;; Reset stream text
              (on-stream-text-reset observer)
              
              ;; Stream text
              (let [text-stream (.-textStream result)]
                (loop []
                  (let [chunk (<! text-stream)]
                    (when chunk
                      (on-stream-text observer chunk)
                      (recur)))))
              
              ;; Check finish reason
              (let [reason (<! (.-finishReason result))]
                (when-not (= reason "tool-calls")
                  (set! break-loop true)))))))))

  (load-history [this]
    (go
      (let [messages (<! (mem/get-all-messages memory))]
        (reset! (:messages this) (vec messages)))))

  (clear-history [this]
    (go
      (reset! (:messages this) [])
      (<! (mem/clear-messages memory))))

  (close [this]
    (mem/close memory)))

;; Constructor function
(defn create-agent [config]
  (->Agent config (atom []) (mem/create-memory)))

;; Helper functions for creating agent config
(defn create-agent-config [model system tools temperature]
  (->AgentConfig model system tools temperature))

;; Example observer implementation
(defrecord SimpleObserver []
  AgentObserver
  (on-stream-text-reset [this]
    (js/console.log "Stream text reset"))
  
  (on-stream-text [this text]
    (js/console.log "Stream text:" text))
  
  (on-finish [this reason]
    (js/console.log "Finished with reason:" reason))
  
  (on-finish-step [this step]
    (js/console.log "Step finished:" step)))

(defn create-simple-observer []
  (->SimpleObserver))