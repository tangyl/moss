(ns memory
  (:require [cljs.core.async :as async :refer [go <!]]
            [clojure.string :as str]
            [\"fs\" :refer [promises]]
            [\"path\" :as path]
            [config :as cfg]))

;; Memory record
(defrecord Memory [file-path messages])

;; Create memory instance
(defn create-memory []
  (let [config (cfg/get-config)
        file-path (path/join (:config-dir config) "memory.jsonl")]
    (->Memory file-path (atom []))))

;; Initialize database
(defn init-database [memory]
  (go
    (try
      (let [content (<! (.readFile promises (:file-path memory) "utf-8"))
            lines (-> content
                      (str/split #\"\\n\")
                      (->> (filter #(not (str/blank? %)))))]
        (doseq [line lines]
          (let [message (js->clj (js/JSON.parse line) :keywordize-keys true)]
            (swap! (:messages memory) conj message))))
      (catch js/Error error
        ;; Create empty file if it doesn't exist
        (if (= (.-code error) \"ENOENT\")
          (<! (.writeFile promises (:file-path memory) \"\" \"utf-8\"))
          (throw error))))))

;; Private function to append to file
(defn- append-to-file [memory message]
  (go
    (let [json-str (js/JSON.stringify (clj->js message))]
      (<! (.appendFile promises (:file-path memory) (str json-str \"\\n\") \"utf-8\")))))

;; Save message
(defn save-message [memory message]
  (go
    (swap! (:messages memory) conj message)
    (<! (append-to-file memory message))))

;; Get message by ID
(defn get-message [memory id]
  (go
    (->> @(:messages memory)
         (filter #(= (:id %) id))
         first)))

;; Get all messages
(defn get-all-messages [memory]
  (go
    (vec @(:messages memory))))

;; Delete message
(defn delete-message [memory id]
  (go
    (swap! (:messages memory) #(filterv (fn [msg] (not= (:id msg) id)) %))
    (<! (rewrite-file memory))))

;; Clear all messages
(defn clear-messages [memory]
  (go
    (reset! (:messages memory) [])
    (<! (.writeFile promises (:file-path memory) \"\" \"utf-8\"))))

;; Private function to rewrite file
(defn- rewrite-file [memory]
  (go
    (let [content (->> @(:messages memory)
                       (map #(js/JSON.stringify (clj->js %)))
                       (str/join \"\\n\")
                       (#(str % \"\\n\")))]
      (<! (.writeFile promises (:file-path memory) content \"utf-8\")))))

;; Close memory (no-op in this implementation)
(defn close [memory]
  ;; No need to close file as each operation is independent
  nil)