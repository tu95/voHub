package device

import "github.com/tu95/vohub/internal/vowifihost"

func (p *Pool) voWiFiHost() *vowifihost.Manager {
	if p == nil {
		return vowifihost.NewManager()
	}
	if p.vowifiHost == nil {
		p.vowifiHost = vowifihost.NewManager()
	}
	return p.vowifiHost
}
