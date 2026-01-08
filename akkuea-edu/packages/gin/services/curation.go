package services

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// CurationStatus represents moderation outcome
type CurationStatus string

const (
	StatusApproved CurationStatus = "Approved"
	StatusPending  CurationStatus = "Pending"
	StatusRejected CurationStatus = "Rejected"
)

// CurationResult is the output of curation
type CurationResult struct {
	Status CurationStatus `json:"status"`
	Reason string         `json:"reason"`
}

// CurationService analyzes content via configured provider (xAI Grok) with graceful fallback
type CurationService struct {
	httpClient *http.Client
	provider   string
	xaiAPIKey  string
	xaiBaseURL string
	xaiModel   string
}

func NewCurationService() *CurationService {
	timeout := 12 * time.Second
	return &CurationService{
		httpClient: &http.Client{Timeout: timeout},
		provider:   getEnv("CURATION_PROVIDER", "xai"),
		xaiAPIKey:  os.Getenv("XAI_API_KEY"),
		xaiBaseURL: getEnv("XAI_BASE_URL", "https://api.x.ai/v1"),
		xaiModel:   getEnv("XAI_MODEL", "grok-3-mini"),
	}
}

// CurateContent sends content to AI for moderation. On error, returns Pending with reason.
func (s *CurationService) CurateContent(title, content, language, format string) CurationResult {
	// Basic local heuristics first (cheap guardrails)
	if r := heuristicModeration(title, content); r.Status == StatusRejected {
		return r
	}

	switch strings.ToLower(s.provider) {
	case "xai", "grok", "grok3":
		res, err := s.curateWithXAI(title, content, language, format)
		if err != nil {
			log.Printf("AI curation error: %v", err)
			return CurationResult{Status: StatusPending, Reason: fmt.Sprintf("AI curation error: %v", err)}
		}
		return res
	default:
		// Unknown provider → be safe
		return CurationResult{Status: StatusPending, Reason: "Unknown curation provider; defaulting to Pending"}
	}
}

// xAI Chat Completions minimal schema
type xaiChatMessage struct {
	Role    string      `json:"role"`
	Content interface{} `json:"content"`
}

type xaiChatRequest struct {
	Model    string           `json:"model"`
	Messages []xaiChatMessage `json:"messages"`
}

type xaiChatChoice struct {
	Message struct {
		Content string `json:"content"`
	} `json:"message"`
}

type xaiChatResponse struct {
	Choices []xaiChatChoice `json:"choices"`
}

func (s *CurationService) curateWithXAI(title, content, language, format string) (CurationResult, error) {
	if s.xaiAPIKey == "" {
		// Not configured → safe default
		return CurationResult{Status: StatusPending, Reason: "XAI_API_KEY not configured"}, nil
	}

	sys := "You are a strict content moderator for an educational platform. Given a resource's title, content, language, and format, classify it as Approved (safe, educational), Pending (uncertain or needs manual review), or Rejected (inappropriate, unsafe, spam, hateful, explicit, illegal). Respond ONLY in JSON: {\"status\":\"Approved|Pending|Rejected\",\"reason\":\"short reason\"}. Keep reason concise."
	user := fmt.Sprintf("Title: %s\nLanguage: %s\nFormat: %s\nContent:\n%s", truncate(title, 300), language, format, truncate(content, 6000))

	body := xaiChatRequest{
		Model: s.xaiModel,
		Messages: []xaiChatMessage{
			{Role: "system", Content: sys},
			{Role: "user", Content: user},
		},
	}

	payload, _ := json.Marshal(body)
	req, err := http.NewRequest("POST", s.xaiBaseURL+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return CurationResult{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.xaiAPIKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return CurationResult{}, err
	}
	defer func() {
		if cerr := resp.Body.Close(); cerr != nil {
			log.Printf("curation: failed to close response body: %v", cerr)
		}
	}()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return CurationResult{}, fmt.Errorf("xAI API status %d", resp.StatusCode)
	}

	var xr xaiChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&xr); err != nil {
		return CurationResult{}, err
	}
	if len(xr.Choices) == 0 {
		return CurationResult{}, errors.New("xAI: no choices in response")
	}
	contentOut := xr.Choices[0].Message.Content

	// Try to parse JSON from the model's response; if parsing fails, fall back to heuristic
	var parsed CurationResult
	if err := json.Unmarshal([]byte(contentOut), &parsed); err == nil {
		if parsed.Status == "" {
			parsed.Status = StatusPending
		}
		return parsed, nil
	}
	// If model returned plain text, map to categories
	lower := strings.ToLower(contentOut)
	switch {
	case strings.Contains(lower, "reject") || strings.Contains(lower, "unsafe") || strings.Contains(lower, "inappropriate"):
		return CurationResult{Status: StatusRejected, Reason: "Model indicated rejection"}, nil
	case strings.Contains(lower, "approve") || strings.Contains(lower, "safe"):
		return CurationResult{Status: StatusApproved, Reason: "Model indicated approval"}, nil
	default:
		return CurationResult{Status: StatusPending, Reason: "Unclear model response"}, nil
	}
}

func heuristicModeration(title, content string) CurationResult {
	// Very simple blocklist for obvious issues. Extend as needed.
	blocklist := []string{
		"porn", "nsfw", "rape", "kill", "suicide", "bomb", "terror", "hate", "racist", "sex", "xxx",
	}
	text := strings.ToLower(title + "\n" + content)
	for _, w := range blocklist {
		if strings.Contains(text, w) {
			return CurationResult{Status: StatusRejected, Reason: "Contains prohibited term: " + w}
		}
	}
	// If content is extremely short or empty, mark Pending
	if len(strings.TrimSpace(content)) < 30 {
		return CurationResult{Status: StatusPending, Reason: "Content too short for auto-approval"}
	}
	return CurationResult{Status: StatusApproved, Reason: "Heuristics passed"}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	if n <= 3 {
		return s[:n]
	}
	return s[:n-3] + "..."
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
