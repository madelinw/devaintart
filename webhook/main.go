package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"
)

func main() {
	secret := os.Getenv("WEBHOOK_SECRET")
	if secret == "" {
		log.Fatal("WEBHOOK_SECRET environment variable required")
	}

	http.HandleFunc("/webhook", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Read body
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Failed to read body", http.StatusBadRequest)
			return
		}

		// Verify signature
		signature := r.Header.Get("X-Hub-Signature-256")
		if !verifySignature(body, signature, secret) {
			log.Println("Invalid signature")
			http.Error(w, "Invalid signature", http.StatusUnauthorized)
			return
		}

		// Check if it's a push to main
		ref := r.Header.Get("X-GitHub-Event")
		if ref != "push" {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("Ignored: not a push event"))
			return
		}

		// Check branch (simple check in body)
		if !strings.Contains(string(body), `"ref":"refs/heads/main"`) {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("Ignored: not main branch"))
			return
		}

		log.Println("Received push to main, deploying...")

		// Run deploy script in background
		go func() {
			cmd := exec.Command("/home/dorkitude/a/dev/devaintart/deploy.sh")
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr
			if err := cmd.Run(); err != nil {
				log.Printf("Deploy failed: %v", err)
			} else {
				log.Println("Deploy succeeded")
			}
		}()

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Deploying..."))
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "9000"
	}

	log.Printf("Webhook server listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

func verifySignature(payload []byte, signature, secret string) bool {
	if !strings.HasPrefix(signature, "sha256=") {
		return false
	}
	sig := strings.TrimPrefix(signature, "sha256=")

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expected := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(sig), []byte(expected))
}
