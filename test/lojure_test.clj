;; TODO: Scrivere test
(defn check-note [note]
  (if (not note) ; Falso positivo (! e not e note)
    (println "note is nil") ; Falso positivo come stringa
    ;; FIXME: Cambiare il print formatter
    (println note)))

;; HACK: Vecchia API Lisp
(def my-note 'todo) ; non deve rilevare 'todo
