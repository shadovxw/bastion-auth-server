package auth

import (
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"sync"
	"time"
)

type jwkKey struct {
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	Alg string `json:"alg"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type jwksResponse struct {
	Keys []jwkKey `json:"keys"`
}

type jwksCache struct {
	mu        sync.RWMutex
	keys      map[string]*rsa.PublicKey
	fetchedAt time.Time
	ttl       time.Duration
	url       string
}

func newJWKSCache(authServer string) *jwksCache {
	return &jwksCache{
		url:  authServer + "/.well-known/jwks.json",
		ttl:  time.Hour,
		keys: make(map[string]*rsa.PublicKey),
	}
}

func (c *jwksCache) getKey(kid string) (*rsa.PublicKey, error) {
	c.mu.RLock()
	key, ok := c.keys[kid]
	expired := time.Since(c.fetchedAt) > c.ttl
	c.mu.RUnlock()

	if ok && !expired {
		return key, nil
	}

	// Refetch — handles key rotation and cold start
	if err := c.fetch(); err != nil {
		return nil, err
	}

	c.mu.RLock()
	key, ok = c.keys[kid]
	c.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("unknown kid: %s", kid)
	}
	return key, nil
}

func (c *jwksCache) fetch() error {
	resp, err := http.Get(c.url)
	if err != nil {
		return fmt.Errorf("jwks fetch: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	var jwks jwksResponse
	if err := json.Unmarshal(body, &jwks); err != nil {
		return fmt.Errorf("jwks parse: %w", err)
	}

	keys := make(map[string]*rsa.PublicKey, len(jwks.Keys))
	for _, k := range jwks.Keys {
		if k.Kty != "RSA" {
			continue
		}
		pub, err := parseRSAKey(k.N, k.E)
		if err != nil {
			continue
		}
		keys[k.Kid] = pub
	}

	c.mu.Lock()
	c.keys = keys
	c.fetchedAt = time.Now()
	c.mu.Unlock()

	return nil
}

func parseRSAKey(nStr, eStr string) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(nStr)
	if err != nil {
		return nil, err
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(eStr)
	if err != nil {
		return nil, err
	}

	e := 0
	for _, b := range eBytes {
		e = e<<8 | int(b)
	}

	return &rsa.PublicKey{
		N: new(big.Int).SetBytes(nBytes),
		E: e,
	}, nil
}
