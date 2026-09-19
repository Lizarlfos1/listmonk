package main

import (
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

// Sim Sense fork: proxy to the drip API.
//
// The Sequences section of the admin needs data from the CRM API, which is a
// separate process. Proxying it through here rather than calling it from the
// browser buys two things:
//
//   - Same origin, so no CORS configuration and no second host to expose.
//   - The CRM API token stays on the server. Calling directly would mean
//     shipping a token that can approve and enrol into every admin's
//     localStorage, which is a much worse credential to leave lying about than
//     a session cookie.
//
// The route is registered inside the authenticated group, so reaching it
// already requires a Listmonk admin session.

const crmProxyPrefix = "/api/crm"

type crmConfig struct {
	url   string
	token string
}

func newCRMConfig() crmConfig {
	return crmConfig{
		url:   strings.TrimSuffix(os.Getenv("CRM_API_URL"), "/"),
		token: os.Getenv("CRM_API_TOKEN"),
	}
}

var crmClient = &http.Client{Timeout: 30 * time.Second}

// CRMProxy forwards /api/crm/* to the drip API, attaching its bearer token.
func (a *App) CRMProxy(c echo.Context) error {
	cfg := newCRMConfig()
	if cfg.url == "" || cfg.token == "" {
		// Deliberately explicit rather than a generic 502: an unset variable is
		// the overwhelmingly likely cause and saying so saves a log dive.
		return echo.NewHTTPError(http.StatusServiceUnavailable,
			"CRM_API_URL and CRM_API_TOKEN are not set on this listmonk process")
	}

	path := strings.TrimPrefix(c.Request().URL.Path, crmProxyPrefix)
	if path == "" {
		path = "/"
	}
	target := cfg.url + path
	if raw := c.Request().URL.RawQuery; raw != "" {
		target += "?" + raw
	}
	if _, err := url.Parse(target); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "bad upstream path")
	}

	req, err := http.NewRequestWithContext(c.Request().Context(),
		c.Request().Method, target, c.Request().Body)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if ct := c.Request().Header.Get("Content-Type"); ct != "" {
		req.Header.Set("Content-Type", ct)
	}
	req.Header.Set("Authorization", "Bearer "+cfg.token)

	res, err := crmClient.Do(req)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, "CRM API unreachable: "+err.Error())
	}
	defer res.Body.Close()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, "CRM API read failed: "+err.Error())
	}

	// The CRM API returns bare JSON; listmonk's frontend interceptor expects
	// everything wrapped in {"data": ...} and unwraps it before the caller sees
	// it. Wrapping here rather than special-casing the frontend keeps the Vue
	// side using the same api helpers and interceptor as every other screen.
	c.Response().Header().Set("Content-Type", "application/json")
	c.Response().WriteHeader(res.StatusCode)

	if res.StatusCode >= 400 {
		// Errors are passed through untouched: listmonk's interceptor reads
		// .message off them, and the CRM's {error, detail} is more useful to
		// show than a wrapped version of it.
		_, err = c.Response().Write(body)
		return err
	}

	if len(body) == 0 {
		body = []byte("null")
	}
	if _, err := c.Response().Write([]byte(`{"data":`)); err != nil {
		return err
	}
	if _, err := c.Response().Write(body); err != nil {
		return err
	}
	_, err = c.Response().Write([]byte(`}`))
	return err
}
