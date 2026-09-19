# CONT-P17 — 02 SLOs / Alerts / Dashboards (WS-17.2, DEL-02)

## Verified @ HEAD (parsed, not screenshots)

| Artifact | Check | Result |
| --- | --- | --- |
| 4 Grafana dashboards | JSON parse + panel count | agents 7, backend 8, latency 8, vaeloom-main 8 = **31 panels** |
| `prometheus-alerts.yml` + `vaeloom-alerts.yml` | YAML parse | 4 groups, **24 rules** |
| `alertmanager.yml` | present | routing config |
| `prometheus.yml` | scrape config present | jobs defined |
| `SLO.md` | 6 targets + budgets + ladder | carried, current |
| Provisioning | grafana datasource + dashboard provisioning YAMLs | present |

Promtool binary absent locally → rule syntax validated by YAML parse only;
`promtool check rules` is CI/manual follow-up (recorded, low risk: files
unchanged since P17-era baselines that passed promtool).
