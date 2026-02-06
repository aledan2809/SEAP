import Anthropic from '@anthropic-ai/sdk';

// Types based on Prisma schema
interface TenderForAnalysis {
  id: string;
  title: string;
  description: string | null;
  contractingAuth: string;
  contractingAuthCui: string | null;
  estimatedValue: number | null;
  currency: string;
  cpvCode: string;
  cpvDescription: string | null;
  procedureType: string;
  contractType: string | null;
  publicationDate: Date | null;
  submissionDeadline: Date | null;
  organization: {
    name: string;
    cui: string;
    cpvCodes: string[];
    keywords: string[];
  };
  documents: Array<{
    filename: string;
    docType: string;
    ocrText: string | null;
  }>;
}

interface AnalysisResult {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  recommendation: 'GO' | 'CAUTION' | 'NO_GO';
  aiSummary: string;
  aiNotes: string | null;
  qualificationReqs: Record<string, unknown> | null;
  technicalSpecs: Record<string, unknown> | null;
  evaluationCriteria: Record<string, unknown> | null;
  keyDates: Record<string, unknown> | null;
  confidence: number;
  modelUsed: string;
}

const SYSTEM_PROMPT = `Ești un expert în achiziții publice din România, specializat în analiza licitațiilor de pe SEAP.
Rolul tău este să analizezi licitațiile și să oferi o evaluare SWOT completă pentru a ajuta firmele să decidă dacă să participe.

Răspunde ÎNTOTDEAUNA în limba română.

Analizează cu atenție:
1. Cerințele de calificare (cifra de afaceri, experiență similară, personal)
2. Specificațiile tehnice și dacă sunt restrictive sau deschise
3. Termenele limită și dacă sunt rezonabile
4. Criteriile de atribuire (preț cel mai mic vs. cel mai avantajos)
5. Riscurile și oportunitățile contractului

Oferă răspunsul în format JSON strict, fără alte explicații.`;

function buildAnalysisPrompt(tender: TenderForAnalysis): string {
  const documentsContext = tender.documents
    .filter((doc) => doc.ocrText)
    .map((doc) => `--- ${doc.filename} (${doc.docType}) ---\n${doc.ocrText?.substring(0, 10000)}`)
    .join('\n\n');

  const deadline = tender.submissionDeadline
    ? new Date(tender.submissionDeadline).toLocaleDateString('ro-RO')
    : 'Necunoscut';

  const daysRemaining = tender.submissionDeadline
    ? Math.ceil(
        (new Date(tender.submissionDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;

  return `Analizează următoarea licitație pentru firma "${tender.organization.name}" (CUI: ${tender.organization.cui}):

## Informații Licitație
- **Titlu:** ${tender.title}
- **Descriere:** ${tender.description || 'N/A'}
- **Autoritate Contractantă:** ${tender.contractingAuth} ${tender.contractingAuthCui ? `(CUI: ${tender.contractingAuthCui})` : ''}
- **Valoare Estimată:** ${tender.estimatedValue ? `${tender.estimatedValue} ${tender.currency}` : 'Nedefinită'}
- **Cod CPV:** ${tender.cpvCode} - ${tender.cpvDescription || ''}
- **Tip Procedură:** ${tender.procedureType}
- **Tip Contract:** ${tender.contractType || 'N/A'}
- **Termen Depunere:** ${deadline}${daysRemaining !== null ? ` (${daysRemaining} zile rămase)` : ''}

## Profilul Firmei Noastre
- Coduri CPV de activitate: ${tender.organization.cpvCodes.join(', ') || 'Nespecificate'}
- Cuvinte cheie de interes: ${tender.organization.keywords.join(', ') || 'Nespecificate'}

${documentsContext ? `## Conținut Documente Licitație\n${documentsContext}` : '## Notă: Nu sunt disponibile documente OCR-izate pentru această licitație.'}

---

Răspunde cu un JSON valid având exact această structură:
{
  "strengths": ["punct tare 1", "punct tare 2", ...],
  "weaknesses": ["punct slab 1", "punct slab 2", ...],
  "opportunities": ["oportunitate 1", "oportunitate 2", ...],
  "threats": ["amenințare 1", "amenințare 2", ...],
  "recommendation": "GO" | "CAUTION" | "NO_GO",
  "aiSummary": "Rezumat în 2-3 propoziții cu concluzia principală",
  "aiNotes": "Note adiționale sau recomandări specifice",
  "qualificationReqs": {
    "cifraAfaceri": "valoare sau null",
    "experientaSimilara": "descriere sau null",
    "personal": "cerințe personal sau null"
  },
  "technicalSpecs": {
    "descriere": "rezumat specificații tehnice",
    "restrictive": true/false
  },
  "evaluationCriteria": {
    "tip": "pret_minim" | "calitate_pret",
    "ponderi": {}
  },
  "keyDates": {
    "depunere": "data",
    "deschidere": "data sau null",
    "altele": []
  },
  "confidence": 0.0-1.0
}`;
}

export async function analyzeWithClaude(tender: TenderForAnalysis): Promise<AnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const client = new Anthropic({ apiKey });
  const modelId = 'claude-sonnet-4-20250514';

  const message = await client.messages.create({
    model: modelId,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildAnalysisPrompt(tender),
      },
    ],
  });

  // Extract text content from response
  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Parse JSON response
  const responseText = textContent.text.trim();

  // Extract JSON from potential markdown code blocks
  let jsonText = responseText;
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim();
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    console.error('Failed to parse Claude response:', responseText);
    throw new Error('Invalid JSON response from Claude');
  }

  // Validate and normalize response
  const result: AnalysisResult = {
    strengths: Array.isArray(parsed.strengths) ? (parsed.strengths as string[]) : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? (parsed.weaknesses as string[]) : [],
    opportunities: Array.isArray(parsed.opportunities) ? (parsed.opportunities as string[]) : [],
    threats: Array.isArray(parsed.threats) ? (parsed.threats as string[]) : [],
    recommendation: validateRecommendation(parsed.recommendation),
    aiSummary: typeof parsed.aiSummary === 'string' ? parsed.aiSummary : 'Analiză finalizată.',
    aiNotes: typeof parsed.aiNotes === 'string' ? parsed.aiNotes : null,
    qualificationReqs:
      parsed.qualificationReqs && typeof parsed.qualificationReqs === 'object'
        ? (parsed.qualificationReqs as Record<string, unknown>)
        : null,
    technicalSpecs:
      parsed.technicalSpecs && typeof parsed.technicalSpecs === 'object'
        ? (parsed.technicalSpecs as Record<string, unknown>)
        : null,
    evaluationCriteria:
      parsed.evaluationCriteria && typeof parsed.evaluationCriteria === 'object'
        ? (parsed.evaluationCriteria as Record<string, unknown>)
        : null,
    keyDates:
      parsed.keyDates && typeof parsed.keyDates === 'object'
        ? (parsed.keyDates as Record<string, unknown>)
        : null,
    confidence:
      typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.7,
    modelUsed: modelId,
  };

  return result;
}

function validateRecommendation(value: unknown): 'GO' | 'CAUTION' | 'NO_GO' {
  if (value === 'GO' || value === 'CAUTION' || value === 'NO_GO') {
    return value;
  }
  return 'CAUTION'; // Default to CAUTION if invalid
}

export type { TenderForAnalysis, AnalysisResult };
