# n8n Workflows pentru SEAP Assistant

Acest folder conține workflow-urile n8n pentru automatizarea căutării și procesării licitațiilor.

## Setup Rapid

### 1. Configurează Credentials în n8n

Creează un credential de tip **Header Auth**:
- **Name**: `SEAP API Key`
- **Header Name**: `x-api-key`
- **Header Value**: (generează un string random și pune-l și în `.env` la `N8N_API_KEY`)

### 2. Configurează Environment Variables în n8n

În n8n → Settings → Variables, adaugă:

| Variable | Value |
|----------|-------|
| `SEAP_APP_URL` | `http://localhost:3000` (sau URL-ul public) |

### 3. Importă Workflow-urile

1. În n8n, click pe **Add workflow** → **Import from file**
2. Selectează fișierele JSON din acest folder
3. Activează workflow-ul

---

## Workflows Disponibile

### 01-seap-scanner.json - Căutare Licitații

**Ce face:**
- Rulează la fiecare 30 minute
- Obține codurile CPV de monitorizat din app
- Caută pe SEAP după fiecare cod CPV
- Trimite licitațiile găsite înapoi la app prin webhook

**Configurare:**
1. Importă workflow-ul
2. Verifică că credentials-urile sunt setate corect
3. Activează workflow-ul (toggle din dreapta sus)

**Testare:**
- Click pe **Execute Workflow** pentru a rula manual
- Verifică în app la `/tenders` dacă apar licitații noi

---

## API Endpoints

Aplicația expune următoarele endpoint-uri pentru n8n:

### GET /api/organizations/cpv-codes
Returnează codurile CPV de monitorizat.

**Response:**
```json
{
  "organizations": [...],
  "cpvCodes": ["30213100-6", "48000000-8", ...],
  "source": "default" | "custom"
}
```

### POST /api/webhooks/n8n
Primește evenimente de la n8n.

**Events:**
- `tender_found` - Licitație nouă găsită
- `documents_downloaded` - Documente descărcate
- `analysis_complete` - Analiză AI finalizată
- `clarification_published` - Clarificare nouă publicată
- `deadline_approaching` - Deadline aproape
- `tender_updated` - Licitație actualizată

**Request:**
```json
{
  "event": "tender_found",
  "data": {
    "seapId": "CN123456",
    "title": "Furnizare laptopuri",
    "contractingAuth": "Primaria X",
    "estimatedValue": 150000,
    "cpvCode": "30213100-6",
    "submissionDeadline": "2024-02-15T12:00:00Z",
    "seapUrl": "https://e-licitatie.ro/..."
  },
  "timestamp": "2024-01-20T10:00:00Z"
}
```

### GET /api/webhooks/n8n
Health check - verifică că webhook-ul e disponibil.

---

## Troubleshooting

### Workflow nu găsește licitații
1. Verifică că `SEAP_APP_URL` e setat corect în n8n Variables
2. Verifică că app-ul rulează și e accesibil de la n8n
3. Verifică logs în n8n pentru erori de conexiune

### Licitațiile nu apar în app
1. Verifică în Neon că tabelul `Tender` are date
2. Verifică logs în consola aplicației
3. Verifică că organizația are CPV codes setate (sau lasă gol pentru toate)

### API returnează 401 Unauthorized
1. Verifică că `N8N_API_KEY` din `.env` match-uiește cu header-ul din n8n
2. Sau șterge `N8N_API_KEY` din `.env` pentru a dezactiva autentificarea

---

## Dezvoltare

Pentru a modifica workflow-urile:
1. Editează în n8n UI
2. Export → Download as file
3. Înlocuiește JSON-ul din acest folder
4. Commit în git
