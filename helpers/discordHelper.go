package helpers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

func SendDiscordNewUserMessage(email string, username string) {
	webhookURL := os.Getenv("DISCORD_NEW_USER_WEBHOOK")
	env := os.Getenv("ENVIRONMENT")
	if webhookURL == "" {
		log.Printf("DISCORD_NEW_USER_WEBHOOK is not set")
		return
	}

	type discordPayload struct {
		Content string `json:"content"`
	}

	payload := discordPayload{
		Content: fmt.Sprintf("[%s] New user signed up: %s (%s)", env, username, email),
	}

	b, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Failed to marshal Discord payload: %v", err)
		return
	}

	client := &http.Client{Timeout: 5 * time.Second}
	req, err := http.NewRequest(http.MethodPost, webhookURL, bytes.NewBuffer(b))
	if err != nil {
		log.Printf("Failed to create Discord webhook request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Failed to send Discord webhook: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("Discord webhook returned status %d: %s", resp.StatusCode, string(body))
	}
}

func SendDiscordReportErrorMessage(message string, err error) {
	webhookURL := os.Getenv("DISCORD_REPORT_WEBHOOK")
	env := os.Getenv("ENVIRONMENT")
	if webhookURL == "" {
		return
	}

	errText := ""
	if err != nil {
		errText = err.Error()
	}

	content := fmt.Sprintf(
		"[%s] Report tool error\nMessage: %s\nError: %s\nTime: %s",
		env,
		message,
		errText,
		time.Now().UTC().Format(time.RFC3339),
	)

	sendDiscordReportContent(webhookURL, content)
}

// SendDiscordReport posts a (potentially structured) report to the DISCORD_REPORT_WEBHOOK.
// If report is not a string, it is formatted as a readable table.
// Large messages are truncated to fit Discord's content limit.
func SendDiscordReport(report interface{}) {
	webhookURL := os.Getenv("DISCORD_REPORT_WEBHOOK")
	env := os.Getenv("ENVIRONMENT")
	if webhookURL == "" {
		log.Printf("DISCORD_REPORT_WEBHOOK is not set")
		return
	}

	var body string
	switch v := report.(type) {
	case string:
		body = v
	default:
		// Try to format as a table instead of JSON
		tableBody := formatReportAsTable(v)
		if tableBody != "" {
			body = tableBody
		} else {
			// Fallback to JSON if table formatting fails
			b, err := json.MarshalIndent(v, "", "  ")
			if err != nil {
				// Fallback to a plain error message if marshaling fails
				SendDiscordReportErrorMessage("failed to marshal report payload", err)
				return
			}
			// Wrap as a code block for readability
			body = fmt.Sprintf("```json\n%s\n```", string(b))
		}
	}

	content := fmt.Sprintf(
		"[%s] Daily report\nTime: %s\n%s\n",
		env,
		time.Now().UTC().Format(time.RFC3339),
		body,
	)

	sendDiscordReportContent(webhookURL, content)
}

// sendDiscordReportContent sends the given content to the specified Discord webhook URL,
// truncating content if necessary and logging non-2xx responses.
func sendDiscordReportContent(webhookURL, content string) {
	// Discord content limit is 2000 characters for the "content" field.
	const discordLimit = 2000
	type discordPayload struct {
		Content string `json:"content"`
	}

	if len(content) > discordLimit {
		// Keep a clear indication that content was truncated.
		const suffix = "\n\n…[truncated]"
		max := discordLimit - len(suffix)
		if max < 0 {
			max = 0
		}
		content = content[:max] + suffix
	}

	payload := discordPayload{Content: content}
	b, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Failed to marshal Discord report payload: %v", err)
		return
	}

	client := &http.Client{Timeout: 8 * time.Second}
	req, err := http.NewRequest(http.MethodPost, webhookURL, bytes.NewBuffer(b))
	if err != nil {
		log.Printf("Failed to create Discord report request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Failed to send Discord report webhook: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("Discord report webhook returned status %d: %s", resp.StatusCode, string(body))
	}
}

// formatReportAsTable attempts to format a report as a readable table.
// Returns an empty string if the report type is not supported.
func formatReportAsTable(report interface{}) string {
	// Try to marshal to JSON first to work with the data
	b, err := json.Marshal(report)
	if err != nil {
		return ""
	}

	// Try to unmarshal into a generic map to inspect structure
	var data map[string]interface{}
	if err := json.Unmarshal(b, &data); err != nil {
		return ""
	}

	var result []string
	result = append(result, "```")
	result = append(result, "📊 DAILY REPORT")
	result = append(result, "")

	// Format campaigns section
	if campaigns, ok := data["campaigns"].([]interface{}); ok {
		result = append(result, fmt.Sprintf("🎯 NEW CAMPAIGNS (%d)", len(campaigns)))
		result = append(result, strings.Repeat("-", 50))
		if len(campaigns) == 0 {
			result = append(result, "No new campaigns created")
		} else {
			for i, campaign := range campaigns {
				if c, ok := campaign.(map[string]interface{}); ok {
					name := getString(c, "name", "Unknown")
					email := getString(c, "email", "Unknown")
					createdAt := getString(c, "created_at", "Unknown")

					result = append(result, fmt.Sprintf("%d. %s", i+1, name))
					result = append(result, fmt.Sprintf("   User: %s", email))
					result = append(result, fmt.Sprintf("   Created: %s", createdAt))
					result = append(result, "")
				}
			}
		}
		result = append(result, "")
	}

	// Format event streaming reports section
	if reports, ok := data["event_streaming_reports"].([]interface{}); ok {
		result = append(result, fmt.Sprintf("📹 SESSION ACTIVITY (%d)", len(reports)))
		result = append(result, strings.Repeat("-", 50))
		if len(reports) == 0 {
			result = append(result, "No session activity")
		} else {
			for i, report := range reports {
				if r, ok := report.(map[string]interface{}); ok {
					campaignName := getString(r, "campaign_name", "Unknown")
					userEmail := getString(r, "user_email", "Unknown")
					sessionCount := getFloat64(r, "event_count", 0)

					result = append(result, fmt.Sprintf("%d. %s", i+1, campaignName))
					result = append(result, fmt.Sprintf("   User: %s", userEmail))
					result = append(result, fmt.Sprintf("   Sessions: %.0f", sessionCount))
					result = append(result, "")
				}
			}
		}
	}

	result = append(result, "```")
	return strings.Join(result, "\n")
}

// Helper functions for safe type assertions
func getString(m map[string]interface{}, key, defaultVal string) string {
	if val, ok := m[key].(string); ok {
		return val
	}
	return defaultVal
}

func getFloat64(m map[string]interface{}, key string, defaultVal float64) float64 {
	if val, ok := m[key].(float64); ok {
		return val
	}
	return defaultVal
}
