import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register fonts (optional - using default for now)
// Font.register({ family: 'Roboto', src: '...' });

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#1a1a1a',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  seapId: {
    fontSize: 10,
    color: '#666666',
    fontFamily: 'Courier',
    marginBottom: 5,
  },
  organizationName: {
    fontSize: 12,
    color: '#1a1a1a',
    marginBottom: 15,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1a1a1a',
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    width: '35%',
    fontSize: 10,
    color: '#666666',
    fontWeight: 'bold',
  },
  value: {
    width: '65%',
    fontSize: 10,
    color: '#1a1a1a',
  },
  description: {
    fontSize: 10,
    lineHeight: 1.5,
    color: '#333333',
    marginBottom: 10,
  },
  swotContainer: {
    marginBottom: 20,
  },
  swotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  swotBox: {
    width: '48%',
    marginRight: '2%',
    marginBottom: 15,
    padding: 10,
    borderWidth: 1,
    borderRadius: 4,
  },
  swotBoxStrengths: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  swotBoxWeaknesses: {
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  swotBoxOpportunities: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  swotBoxThreats: {
    borderColor: '#ea580c',
    backgroundColor: '#fff7ed',
  },
  swotTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  swotTitleStrengths: {
    color: '#16a34a',
  },
  swotTitleWeaknesses: {
    color: '#dc2626',
  },
  swotTitleOpportunities: {
    color: '#3b82f6',
  },
  swotTitleThreats: {
    color: '#ea580c',
  },
  bulletPoint: {
    fontSize: 9,
    lineHeight: 1.4,
    marginBottom: 4,
    paddingLeft: 10,
  },
  recommendation: {
    padding: 15,
    marginBottom: 20,
    borderRadius: 4,
    borderWidth: 2,
  },
  recommendationGO: {
    backgroundColor: '#f0fdf4',
    borderColor: '#16a34a',
  },
  recommendationCAUTION: {
    backgroundColor: '#fff7ed',
    borderColor: '#ea580c',
  },
  recommendationNO_GO: {
    backgroundColor: '#fef2f2',
    borderColor: '#dc2626',
  },
  recommendationTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  recommendationGOTitle: {
    color: '#16a34a',
  },
  recommendationCAUTIONTitle: {
    color: '#ea580c',
  },
  recommendationNO_GOTitle: {
    color: '#dc2626',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 9,
    color: '#999999',
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
    paddingTop: 10,
  },
});

interface TenderData {
  id: string;
  seapId: string;
  title: string;
  description: string | null;
  contractingAuth: string;
  contractingAuthCui: string | null;
  estimatedValue: unknown;
  currency: string;
  cpvCode: string;
  cpvDescription: string | null;
  procedureType: string;
  contractType: string | null;
  publicationDate: Date | null;
  submissionDeadline: Date | null;
  openingDate: Date | null;
  status: string;
  matchScore: number | null;
  organization: {
    name: string;
  };
  analysis: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
    recommendation: string;
    aiSummary: string | null;
    confidence: number | null;
  } | null;
}

interface TenderPDFDocumentProps {
  tender: TenderData;
}

const recommendationLabels: Record<string, string> = {
  GO: 'RECOMANDAT',
  CAUTION: 'CU REZERVE',
  NO_GO: 'NU SE RECOMANDĂ',
  PENDING: 'ÎN AȘTEPTARE',
};

export function TenderPDFDocument({ tender }: TenderPDFDocumentProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateTime = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatValue = (value: unknown, currency: string) => {
    if (!value) return 'Nedisponibilă';
    return `${Number(value).toLocaleString('ro-RO')} ${currency}`;
  };

  const now = new Date();
  const daysUntilDeadline = tender.submissionDeadline
    ? Math.ceil(
        (new Date(tender.submissionDeadline).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.organizationName}>{tender.organization.name}</Text>
          <Text style={styles.title}>{tender.title}</Text>
          <Text style={styles.seapId}>{tender.seapId}</Text>
        </View>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informații Generale</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Autoritate:</Text>
            <Text style={styles.value}>{tender.contractingAuth}</Text>
          </View>
          {tender.contractingAuthCui && (
            <View style={styles.row}>
              <Text style={styles.label}>CUI:</Text>
              <Text style={styles.value}>{tender.contractingAuthCui}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Valoare estimată:</Text>
            <Text style={styles.value}>
              {formatValue(tender.estimatedValue, tender.currency)}
            </Text>
          </View>
          {tender.matchScore !== null && (
            <View style={styles.row}>
              <Text style={styles.label}>Scor potrivire:</Text>
              <Text style={styles.value}>{tender.matchScore}%</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Cod CPV:</Text>
            <Text style={styles.value}>
              {tender.cpvCode}
              {tender.cpvDescription && ` - ${tender.cpvDescription}`}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tip procedură:</Text>
            <Text style={styles.value}>{tender.procedureType}</Text>
          </View>
          {tender.contractType && (
            <View style={styles.row}>
              <Text style={styles.label}>Tip contract:</Text>
              <Text style={styles.value}>{tender.contractType}</Text>
            </View>
          )}
        </View>

        {/* Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date Importante</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Data publicării:</Text>
            <Text style={styles.value}>{formatDate(tender.publicationDate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Termen depunere:</Text>
            <Text style={styles.value}>{formatDateTime(tender.submissionDeadline)}</Text>
          </View>
          {daysUntilDeadline !== null && daysUntilDeadline > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Zile rămase:</Text>
              <Text style={styles.value}>
                {daysUntilDeadline} {daysUntilDeadline === 1 ? 'zi' : 'zile'}
              </Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Data deschiderii:</Text>
            <Text style={styles.value}>{formatDate(tender.openingDate)}</Text>
          </View>
        </View>

        {/* Description */}
        {tender.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descriere</Text>
            <Text style={styles.description}>{tender.description}</Text>
          </View>
        )}

        {/* AI Analysis */}
        {tender.analysis && (
          <>
            {/* Recommendation */}
            <View
              style={[
                styles.recommendation,
                tender.analysis.recommendation === 'GO'
                  ? styles.recommendationGO
                  : tender.analysis.recommendation === 'CAUTION'
                  ? styles.recommendationCAUTION
                  : styles.recommendationNO_GO,
              ]}
            >
              <Text
                style={[
                  styles.recommendationTitle,
                  tender.analysis.recommendation === 'GO'
                    ? styles.recommendationGOTitle
                    : tender.analysis.recommendation === 'CAUTION'
                    ? styles.recommendationCAUTIONTitle
                    : styles.recommendationNO_GOTitle,
                ]}
              >
                {recommendationLabels[tender.analysis.recommendation] || 'PENDING'}
              </Text>
              {tender.analysis.aiSummary && (
                <Text style={{ fontSize: 10, marginTop: 5 }}>
                  {tender.analysis.aiSummary}
                </Text>
              )}
              {tender.analysis.confidence !== null && (
                <Text style={{ fontSize: 9, marginTop: 5, color: '#666666' }}>
                  Încredere: {Math.round(tender.analysis.confidence * 100)}%
                </Text>
              )}
            </View>

            {/* SWOT Analysis */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Analiză SWOT</Text>
              <View style={styles.swotGrid}>
                {/* Strengths */}
                <View style={[styles.swotBox, styles.swotBoxStrengths]}>
                  <Text style={[styles.swotTitle, styles.swotTitleStrengths]}>
                    Puncte Forte ({tender.analysis.strengths.length})
                  </Text>
                  {tender.analysis.strengths.length > 0 ? (
                    tender.analysis.strengths.map((item, i) => (
                      <Text key={i} style={styles.bulletPoint}>
                        • {item}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.bulletPoint}>Niciun punct identificat</Text>
                  )}
                </View>

                {/* Weaknesses */}
                <View style={[styles.swotBox, styles.swotBoxWeaknesses]}>
                  <Text style={[styles.swotTitle, styles.swotTitleWeaknesses]}>
                    Puncte Slabe ({tender.analysis.weaknesses.length})
                  </Text>
                  {tender.analysis.weaknesses.length > 0 ? (
                    tender.analysis.weaknesses.map((item, i) => (
                      <Text key={i} style={styles.bulletPoint}>
                        • {item}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.bulletPoint}>Niciun punct identificat</Text>
                  )}
                </View>

                {/* Opportunities */}
                <View style={[styles.swotBox, styles.swotBoxOpportunities]}>
                  <Text style={[styles.swotTitle, styles.swotTitleOpportunities]}>
                    Oportunități ({tender.analysis.opportunities.length})
                  </Text>
                  {tender.analysis.opportunities.length > 0 ? (
                    tender.analysis.opportunities.map((item, i) => (
                      <Text key={i} style={styles.bulletPoint}>
                        • {item}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.bulletPoint}>Niciuna identificată</Text>
                  )}
                </View>

                {/* Threats */}
                <View style={[styles.swotBox, styles.swotBoxThreats]}>
                  <Text style={[styles.swotTitle, styles.swotTitleThreats]}>
                    Amenințări ({tender.analysis.threats.length})
                  </Text>
                  {tender.analysis.threats.length > 0 ? (
                    tender.analysis.threats.map((item, i) => (
                      <Text key={i} style={styles.bulletPoint}>
                        • {item}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.bulletPoint}>Niciuna identificată</Text>
                  )}
                </View>
              </View>
            </View>
          </>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Generat de SEAP Assistant • {new Date().toLocaleDateString('ro-RO')}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
