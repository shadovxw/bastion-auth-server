package auth

// Config is provided once when calling New().
type Config struct {
	// AuthServer is the base URL of your Bastion API server.
	// Example: "https://api.auth.shadovxw.me"
	AuthServer string

	// ClientID is the app ID registered in Bastion.
	// Example: "app1"
	ClientID string

	// ClientSecret is only needed for Admin API calls.
	ClientSecret string
}

// User is the decoded JWT payload attached to every authenticated request.
type User struct {
	ID          string   `json:"sub"`
	Email       string   `json:"email"`
	DisplayName string   `json:"displayName"`
	Avatar      string   `json:"avatar"`
	Provider    string   `json:"provider"`
	Roles       []string `json:"roles"`
	Permissions []string `json:"permissions"`
	App         string   `json:"app"`
	ExpiresAt   int64    `json:"exp"`
}

func (u *User) HasPermission(p string) bool {
	for _, perm := range u.Permissions {
		if perm == p {
			return true
		}
	}
	return false
}

func (u *User) HasRole(r string) bool {
	for _, role := range u.Roles {
		if role == r {
			return true
		}
	}
	return false
}
